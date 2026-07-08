// CEO Dashboard — CSV import route (repo convention: route handlers only
// for imports/exports/cron).
//
// POST /api/ceo/import  multipart/form-data { entity_id, import_type, file }
//   finance-role gated. Stores the raw file in the private ceo-imports
//   bucket, validates every row, commits on a clean parse, and records the
//   lifecycle in ceo_imports either way. All-or-nothing: a file with any
//   invalid row commits nothing and returns the row-numbered error report.
// GET /api/ceo/import?type=pnl — returns the CSV header template.
import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertEntityRole } from "@/lib/ceo-dashboard/access";
import {
  IMPORT_TEMPLATES,
  IMPORT_TYPES,
  parseAndValidate,
  commitRows,
  type ImportType,
} from "@/lib/ceo-dashboard/import";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB is thousands of rows — plenty

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const form = await req.formData();
    const entityId = String(form.get("entity_id") ?? "");
    const importType = String(form.get("import_type") ?? "") as ImportType;
    const file = form.get("file");

    if (!IMPORT_TYPES.includes(importType)) {
      return NextResponse.json(
        { error: `import_type must be one of: ${IMPORT_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 2MB)" },
        { status: 413 },
      );
    }

    await assertEntityRole(user.id, entityId, ["finance"]);

    const admin = createSupabaseAdminClient();
    const csvText = await file.text();

    const storagePath = `${entityId}/${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: uploadError } = await admin.storage
      .from("ceo-imports")
      .upload(storagePath, csvText, { contentType: "text/csv" });
    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const { rows, errors } = parseAndValidate(importType, csvText);

    const { data: importRow, error: importInsertError } = await admin
      .from("ceo_imports")
      .insert({
        entity_id: entityId,
        import_type: importType,
        filename: file.name,
        storage_path: storagePath,
        status: errors.length > 0 ? "failed" : "validated",
        row_count: rows.length,
        error_report: errors.length > 0 ? { errors } : null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (importInsertError) {
      return NextResponse.json(
        { error: importInsertError.message },
        { status: 500 },
      );
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, importId: importRow.id, errors },
        { status: 422 },
      );
    }

    const committed = await commitRows(entityId, user.id, importType, rows);

    await admin
      .from("ceo_imports")
      .update({ status: "committed" })
      .eq("id", importRow.id);
    await admin.from("ceo_audit_log").insert({
      user_id: user.id,
      entity_id: entityId,
      table_name: `import:${importType}`,
      record_id: importRow.id,
      action: "import",
      diff: { filename: file.name, rows: committed },
    });

    return NextResponse.json({
      ok: true,
      importId: importRow.id,
      committed,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === "FORBIDDEN" ? 403 : 401;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const type = req.nextUrl.searchParams.get("type") as ImportType | null;
  if (type && IMPORT_TYPES.includes(type)) {
    return NextResponse.json({
      type,
      header: IMPORT_TEMPLATES[type].join(","),
    });
  }
  return NextResponse.json({
    types: IMPORT_TYPES,
    templates: Object.fromEntries(
      IMPORT_TYPES.map((t) => [t, IMPORT_TEMPLATES[t].join(",")]),
    ),
  });
}

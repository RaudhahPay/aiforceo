"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/app/_components/dashboard-primitives";
import {
  SectionCard,
  Table,
  Td,
  Field,
  TextInput,
  NumInput,
  Select,
  FormGrid,
  ActionForm,
  GhostButton,
} from "../_components/ui";
import {
  createEntity,
  updateEntity,
  assignRole,
  removeRole,
} from "@/server/actions/ceo";
import {
  INDUSTRY_LABELS,
  type CeoEntity,
  type CeoRole,
  type IndustryType,
} from "@/lib/ceo-dashboard/types";
import type { RoleView } from "./page";

const ROLE_LABELS: Record<CeoRole, string> = {
  group_ceo: "Group CEO (org-wide, read-all)",
  admin: "Admin (org-wide, manage)",
  venture_ceo: "Venture CEO",
  finance: "Finance (enters financials)",
  marketing: "Marketing",
  ops: "Operations",
};

export function EntitiesClient({
  entities,
  roles,
}: {
  entities: CeoEntity[];
  roles: RoleView[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<IndustryType>("fnb");
  const [weight, setWeight] = useState("0");

  const [roleEmail, setRoleEmail] = useState("");
  const [role, setRole] = useState<CeoRole>("finance");
  const [roleEntity, setRoleEntity] = useState<string>(entities[0]?.id ?? "");

  const orgWide = role === "group_ceo" || role === "admin";

  return (
    <>
      <SectionCard
        title="Ventures"
        note="Weight sets each venture's width on the Group Pulse (use % of group revenue)"
      >
        {entities.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>
            No ventures yet — add the first one below.
          </div>
        ) : (
          <Table
            head={["Venture", "Industry", "Currency", "Weight", "Status", ""]}
          >
            {entities.map((e) => (
              <tr key={e.id}>
                <Td>{e.name}</Td>
                <Td>{INDUSTRY_LABELS[e.industry_type]}</Td>
                <Td>{e.currency}</Td>
                <Td right>{Number(e.sort_weight)}</Td>
                <Td color={e.is_active ? C.green : C.dim}>
                  {e.is_active ? "Active" : "Archived"}
                </Td>
                <Td right>
                  <GhostButton
                    onClick={async () => {
                      const res = await updateEntity(e.id, {
                        is_active: !e.is_active,
                      });
                      if (!res.ok) alert(res.error);
                      router.refresh();
                    }}
                    danger={e.is_active}
                  >
                    {e.is_active ? "Archive" : "Restore"}
                  </GhostButton>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <div style={{ marginTop: 16 }}>
          <ActionForm
            submitLabel="Add venture"
            onSubmit={async () => {
              const res = await createEntity({
                name,
                industry_type: industry,
                currency: "MYR",
                sort_weight: Number(weight) || 0,
              });
              if (res.ok) setName("");
              return res;
            }}
            onDone={() => router.refresh()}
          >
            <FormGrid>
              <Field label="Venture name" width={240}>
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmad's HotChicken"
                  required
                />
              </Field>
              <Field label="Industry" width={200}>
                <Select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as IndustryType)}
                >
                  {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Revenue weight (%)" width={140}>
                <NumInput
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min={0}
                  max={100}
                />
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      </SectionCard>

      <SectionCard
        title="Team access"
        note="Users must have an aiforceo account first. group_ceo reads everything but cannot edit financials — finance enters the numbers."
      >
        {roles.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>
            No roles assigned yet. As workspace owner you already have full
            access to every venture.
          </div>
        ) : (
          <Table head={["User", "Role", "Scope", ""]}>
            {roles.map((r) => (
              <tr key={r.id}>
                <Td>{r.email}</Td>
                <Td>{ROLE_LABELS[r.role]}</Td>
                <Td>{r.entity_name ?? "Org-wide"}</Td>
                <Td right>
                  <GhostButton
                    danger
                    onClick={async () => {
                      if (!window.confirm(`Remove ${r.role} from ${r.email}?`))
                        return;
                      const res = await removeRole(r.id);
                      if (!res.ok) alert(res.error);
                      router.refresh();
                    }}
                  >
                    Remove
                  </GhostButton>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <div style={{ marginTop: 16 }}>
          <ActionForm
            submitLabel="Assign role"
            onSubmit={async () => {
              const res = await assignRole({
                email: roleEmail,
                role,
                entity_id: orgWide ? null : roleEntity || null,
              });
              if (res.ok) setRoleEmail("");
              return res;
            }}
            onDone={() => router.refresh()}
          >
            <FormGrid>
              <Field label="User email" width={240}>
                <TextInput
                  type="email"
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  placeholder="cfo@company.com"
                  required
                />
              </Field>
              <Field label="Role" width={260}>
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CeoRole)}
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              {!orgWide ? (
                <Field label="Venture" width={220}>
                  <Select
                    value={roleEntity}
                    onChange={(e) => setRoleEntity(e.target.value)}
                  >
                    {entities.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </FormGrid>
          </ActionForm>
        </div>
      </SectionCard>
    </>
  );
}

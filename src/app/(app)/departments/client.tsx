"use client";

import { useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Modal, TextField, buttonStyles } from "@/components/ui";
import { DeleteButton } from "@/components/controls";
import {
  saveDepartment,
  deleteDepartment,
  assignDepartmentAccount,
  removeDepartmentAccount,
} from "./actions";

/* Header buttons ----------------------------------------------------------- */

export function DepartmentToolbar() {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      <button onClick={() => setAdding(true)} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        <Plus /> Add Department
      </button>

      <DepartmentFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/* Per-row actions ---------------------------------------------------------- */

export function DepartmentRowActions({
  department,
  assignedEmail,
  isAdmin,
}: {
  department: { id: string; name: string };
  assignedEmail?: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [managingAccount, setManagingAccount] = useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      {isAdmin && (
        <button
          onClick={() => setManagingAccount(true)}
          className={buttonStyles.ghost}
          title={assignedEmail ? "Manage Department Login" : "Assign Department Login"}
          aria-label="Manage Department Login"
        >
          <KeyRound className={assignedEmail ? "text-emerald-600" : "text-amber-500"} />
        </button>
      )}
      <button onClick={() => setEditing(true)} className={buttonStyles.ghost} title="Edit" aria-label="Edit">
        <Pencil />
      </button>
      <DeleteButton action={async () => deleteDepartment(department.id)} />
      <DepartmentFormModal open={editing} onClose={() => setEditing(false)} department={department} />
      <DepartmentAccountModal
        open={managingAccount}
        onClose={() => setManagingAccount(false)}
        department={department}
        assignedEmail={assignedEmail}
      />
    </div>
  );
}

/* Add / edit department form ----------------------------------------------- */

function DepartmentFormModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department?: { id: string; name: string };
}) {
  const [state, action, pending] = useFormAction(saveDepartment, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={department ? "Edit Department" : "New Department"}
      subtitle="Church Administration"
      icon={Users}
      compact
    >
      <form action={action} className="space-y-5 pb-2 text-left">
        {department && <input type="hidden" name="id" value={department.id} />}

        <TextField
          label="Department Name"
          name="name"
          required
          placeholder="e.g. Women of Grace"
          defaultValue={department?.name ?? ""}
        />

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending} className={buttonStyles.submit}>
          {pending ? "Saving…" : department ? "Save Changes" : "Create Department"}
        </button>
      </form>
    </Modal>
  );
}

/* Assign / edit department login account modal ---------------------------- */

function DepartmentAccountModal({
  open,
  onClose,
  department,
  assignedEmail,
}: {
  open: boolean;
  onClose: () => void;
  department: { id: string; name: string };
  assignedEmail?: string;
}) {
  const [state, action, pending] = useFormAction(assignDepartmentAccount, () => {
    toast.success("Department login saved successfully!");
    onClose();
  });
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove the login account for ${department.name}?`)) return;
    setRemoving(true);
    try {
      await removeDepartmentAccount(department.id);
      toast.success("Department account removed.");
      onClose();
    } catch {
      toast.error("Failed to remove account.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Login Account · ${department.name}`}
      subtitle="Department Portal Access"
      icon={KeyRound}
      compact
    >
      <form action={action} className="space-y-4 pb-2 text-left">
        <input type="hidden" name="departmentId" value={department.id} />

        <p className="text-xs text-slate-500">
          This account will only have access to <strong>{department.name}</strong> members, Sunday attendance, and department charts.
        </p>

        <TextField
          label="Account Email"
          name="email"
          type="email"
          required
          placeholder="e.g. choir@church.com"
          defaultValue={assignedEmail ?? ""}
        />

        <TextField
          label={assignedEmail ? "New Password (leave blank to keep current)" : "Password"}
          name="password"
          type="password"
          required={!assignedEmail}
          placeholder={assignedEmail ? "••••••••" : "Minimum 8 characters"}
          defaultValue={assignedEmail ? "" : "WAMCHURCH@26"}
        />

        {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={pending || removing} className={`${buttonStyles.submit} flex-1`}>
            {pending ? "Saving Account…" : assignedEmail ? "Update Credentials" : "Create Department Account"}
          </button>

          {assignedEmail && (
            <button
              type="button"
              disabled={removing || pending}
              onClick={handleRemove}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-red-600 hover:bg-red-100 transition-colors"
              title="Remove Account"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

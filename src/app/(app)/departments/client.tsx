"use client";

import { useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import { toast } from "sonner";
import { Pencil, Plus, Users } from "lucide-react";
import { Modal, TextField, buttonStyles } from "@/components/ui";
import { DeleteButton } from "@/components/controls";
import { saveDepartment, deleteDepartment } from "./actions";

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

export function DepartmentRowActions({ department }: { department: { id: string; name: string } }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="inline-flex items-center gap-1">
      <button onClick={() => setEditing(true)} className={buttonStyles.ghost} title="Edit" aria-label="Edit">
        <Pencil />
      </button>
      <DeleteButton action={async () => deleteDepartment(department.id)} />
      <DepartmentFormModal open={editing} onClose={() => setEditing(false)} department={department} />
    </div>
  );
}

/* Add / edit form ---------------------------------------------------------- */

function DepartmentFormModal({ open, onClose, department }: { open: boolean; onClose: () => void; department?: { id: string; name: string } }) {
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

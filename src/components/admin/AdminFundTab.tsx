
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wallet, Plus, Trash2, Pencil, FileSpreadsheet, Loader2, ArrowDown, ArrowUp, IndianRupee, Building2, X
} from 'lucide-react';

interface FundEntry {
  id: string;
  amount: number;
  source: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

interface Settlement {
  id: string;
  amount: number;
  user_id: string | null;
  mission_id: string | null;
  note: string | null;
  proof_url: string | null;
  settled_by: string | null;
  created_at: string | null;
  status: string | null;
  user_acknowledged: boolean | null;
}

interface AdminFundTabProps {
  settlements: Settlement[];
  users: any[];
  onRefresh: () => void;
}

export default function AdminFundTab({ settlements, users, onRefresh }: AdminFundTabProps) {
  const { user } = useAuth();
  const [fundEntries, setFundEntries] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add fund modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ amount: 0, source: '', note: '' });
  const [saving, setSaving] = useState(false);

  // Edit fund modal
  const [editEntry, setEditEntry] = useState<FundEntry | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, source: '', note: '' });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit settlement
  const [editSettlement, setEditSettlement] = useState<Settlement | null>(null);
  const [editSettlementForm, setEditSettlementForm] = useState({ amount: 0, note: '' });
  const [deleteSettlementId, setDeleteSettlementId] = useState<string | null>(null);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => { fetchFunds(); }, []);

  const fetchFunds = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fund_entries' as any).select('*').order('created_at', { ascending: false });
    if (error) { toast.error(error.message); }
    else { setFundEntries((data as any) || []); }
    setLoading(false);
  };

  const totalFunds = useMemo(() => fundEntries.reduce((s, f) => s + Number(f.amount), 0), [fundEntries]);
  const totalSettled = useMemo(() => settlements.reduce((s, c) => s + Number(c.amount), 0), [settlements]);
  const remainingFunds = totalFunds - totalSettled;

  // --- FUND CRUD ---
  const handleAddFund = async () => {
    if (!addForm.amount || addForm.amount <= 0) return toast.error("Enter a valid amount");
    if (!addForm.source.trim()) return toast.error("Enter source/company name");
    setSaving(true);
    const { error } = await supabase.from('fund_entries' as any).insert({
      amount: addForm.amount, source: addForm.source.trim(), note: addForm.note.trim() || null, created_by: user?.id
    });
    if (error) toast.error(error.message);
    else { toast.success("Fund added!"); setAddForm({ amount: 0, source: '', note: '' }); setIsAddOpen(false); fetchFunds(); }
    setSaving(false);
  };

  const handleEditFund = async () => {
    if (!editEntry) return;
    if (!editForm.amount || editForm.amount <= 0) return toast.error("Invalid amount");
    const { error } = await supabase.from('fund_entries' as any).update({
      amount: editForm.amount, source: editForm.source.trim(), note: editForm.note.trim() || null
    }).eq('id', editEntry.id);
    if (error) toast.error(error.message);
    else { toast.success("Fund updated!"); setEditEntry(null); fetchFunds(); }
  };

  const handleDeleteFund = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('fund_entries' as any).delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Fund entry deleted!"); fetchFunds(); }
    setDeleteId(null);
  };

  // --- SETTLEMENT EDIT/DELETE ---
  const handleEditSettlement = async () => {
    if (!editSettlement) return;
    const { error } = await supabase.from('settlements' as any).update({
      amount: editSettlementForm.amount, note: editSettlementForm.note.trim() || null
    }).eq('id', editSettlement.id);
    if (error) toast.error(error.message);
    else { toast.success("Settlement updated!"); setEditSettlement(null); onRefresh(); }
  };

  const handleDeleteSettlement = async () => {
    if (!deleteSettlementId) return;
    const { error } = await supabase.from('settlements' as any).delete().eq('id', deleteSettlementId);
    if (error) toast.error(error.message);
    else { toast.success("Settlement deleted!"); onRefresh(); }
    setDeleteSettlementId(null);
  };

  // --- EXCEL EXPORTS ---
  const exportFunds = () => {
    if (fundEntries.length === 0) return toast.error("No fund entries to export");
    const rows = fundEntries.map(f => ({
      "Date": new Date(f.created_at).toLocaleDateString(),
      "Amount (₹)": Number(f.amount),
      "Source": f.source, "Note": f.note || ""
    }));
    rows.push({ "Date": "TOTAL", "Amount (₹)": totalFunds, "Source": "", "Note": "" });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funds");
    XLSX.writeFile(wb, `Funds_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Funds exported!");
  };

  const exportSettlements = () => {
    if (settlements.length === 0) return toast.error("No settlements to export");
    const rows = settlements.map(s => {
      const u = users.find(u => u.id === s.user_id);
      return {
        "Date": s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
        "Employee": u?.name || u?.email || "Unknown",
        "Amount (₹)": Number(s.amount),
        "Note": s.note || "", "Proof": s.proof_url || ""
      };
    });
    rows.push({ "Date": "TOTAL PAID", "Employee": "", "Amount (₹)": totalSettled, "Note": "", "Proof": "" });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Settlements");
    XLSX.writeFile(wb, `Settlements_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Settlements exported!");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in pb-24 px-3">
      {/* OVERVIEW CARD */}
      <div className="bg-gray-900 rounded-[2rem] p-5 text-white shadow-xl relative overflow-hidden">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 opacity-80 mb-3">💰 Fund Pool</p>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[8px] font-bold uppercase opacity-40 mb-1 tracking-widest">Remaining Balance</p>
            <h2 className={`text-3xl font-black italic tracking-tighter ${remainingFunds >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{remainingFunds.toLocaleString()}
            </h2>
          </div>
          <div className="text-right space-y-1 pb-1">
            <div className="flex justify-end gap-2 items-center">
              <ArrowDown className="w-3 h-3 text-emerald-400" />
              <span className="text-[7px] font-black opacity-40 uppercase">Received</span>
              <span className="text-[10px] font-bold text-emerald-400">₹{totalFunds.toLocaleString()}</span>
            </div>
            <div className="flex justify-end gap-2 items-center">
              <ArrowUp className="w-3 h-3 text-rose-400" />
              <span className="text-[7px] font-black opacity-40 uppercase">Paid Out</span>
              <span className="text-[10px] font-bold text-rose-400">₹{totalSettled.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ADD FUND BUTTON */}
      <button onClick={() => setIsAddOpen(true)} className="w-full py-4 bg-blue-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
        <Plus className="w-4 h-4" /> Add Money Received
      </button>

      {/* FUND ENTRIES HISTORY */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase opacity-40 tracking-widest italic ml-2">Fund History</span>
          <button onClick={exportFunds} className="text-blue-600 text-[8px] font-black uppercase border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {fundEntries.length > 0 ? fundEntries.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-800">{f.source || 'Company'}</p>
                  <p className="text-[8px] text-gray-400 font-bold">{new Date(f.created_at).toLocaleDateString()} {f.note ? `• ${f.note}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-blue-600">₹{Number(f.amount).toLocaleString()}</span>
                <button onClick={() => { setEditEntry(f); setEditForm({ amount: f.amount, source: f.source, note: f.note || '' }); }}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                  <Pencil className="w-3 h-3 text-gray-400" />
                </button>
                <button onClick={() => setDeleteId(f.id)}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                  <Trash2 className="w-3 h-3 text-rose-400" />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center opacity-10 font-black text-xs italic tracking-widest">No Fund Entries</div>
          )}
        </div>
      </div>

      {/* SETTLEMENT HISTORY WITH EDIT/DELETE */}
      <div className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-3 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase opacity-40 tracking-widest italic ml-2">Payment History (Settled)</span>
          <button onClick={exportSettlements} className="text-emerald-600 text-[8px] font-black uppercase border border-emerald-100 px-2 py-1 rounded-md flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {settlements.length > 0 ? [...settlements].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).map((s) => {
            const u = users.find(u => u.id === s.user_id);
            return (
              <div key={s.id} className="flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-[10px]">💰</div>
                  <div>
                    <p className="text-[10px] font-black text-gray-800">{u?.name || u?.email || 'Unknown'}</p>
                    <p className="text-[8px] text-gray-400 font-bold">{s.created_at ? new Date(s.created_at).toLocaleDateString() : ''} {s.note ? `• ${s.note}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-emerald-600">₹{Number(s.amount).toLocaleString()}</span>
                  {s.proof_url && (
                    <button onClick={() => setPreviewImage(s.proof_url)} className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px]">🖼️</button>
                  )}
                  <button onClick={() => { setEditSettlement(s); setEditSettlementForm({ amount: Number(s.amount), note: s.note || '' }); }}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                    <Pencil className="w-3 h-3 text-gray-400" />
                  </button>
                  <button onClick={() => setDeleteSettlementId(s.id)}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg active:scale-90 transition-all">
                    <Trash2 className="w-3 h-3 text-rose-400" />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center opacity-10 font-black text-xs italic tracking-widest">No Settlements</div>
          )}
        </div>
      </div>

      {/* ADD FUND MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">➕ Add Money</h3>
              <button onClick={() => setIsAddOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="number" placeholder="Amount" value={addForm.amount || ''} onChange={e => setAddForm({ ...addForm, amount: Number(e.target.value) })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" />
            <input type="text" placeholder="Source (e.g. Company Name)" value={addForm.source} onChange={e => setAddForm({ ...addForm, source: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <input type="text" placeholder="Note (optional)" value={addForm.note} onChange={e => setAddForm({ ...addForm, note: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <button onClick={handleAddFund} disabled={saving}
              className="w-full py-5 bg-blue-600 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl active:scale-95 transition-all">
              {saving ? "Saving..." : "Add Fund"}
            </button>
          </div>
        </div>
      )}

      {/* EDIT FUND MODAL */}
      {editEntry && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">✏️ Edit Fund</h3>
              <button onClick={() => setEditEntry(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" />
            <input type="text" value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <button onClick={handleEditFund}
              className="w-full py-5 bg-gray-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* EDIT SETTLEMENT MODAL */}
      {editSettlement && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-[0.2em]">✏️ Edit Settlement</h3>
              <button onClick={() => setEditSettlement(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="number" value={editSettlementForm.amount || ''} onChange={e => setEditSettlementForm({ ...editSettlementForm, amount: Number(e.target.value) })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-2xl font-black outline-none border-2 border-transparent focus:border-gray-100" />
            <input type="text" placeholder="Note" value={editSettlementForm.note} onChange={e => setEditSettlementForm({ ...editSettlementForm, note: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl text-[10px] font-bold outline-none uppercase" />
            <button onClick={handleEditSettlement}
              className="w-full py-5 bg-gray-900 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* DELETE FUND CONFIRM */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fund entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this fund record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFund} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE SETTLEMENT CONFIRM */}
      <AlertDialog open={!!deleteSettlementId} onOpenChange={(o) => !o && setDeleteSettlementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this settlement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this payment record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSettlement} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}

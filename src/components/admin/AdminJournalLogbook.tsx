import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronDown, ChevronRight, User, Target, Calendar,
  MapPin, Users as UsersIcon, FileText, Camera, Eye
} from "lucide-react";
import ImagePreviewModal from "@/components/expense/ImagePreviewModal";
import MissionGallery from "@/components/expense/MissionGallery";

const CATEGORY_DOT_COLORS: Record<string, string> = {
  travel: "bg-blue-500",
  meal: "bg-orange-500",
  hotel: "bg-purple-500",
  luggage: "bg-cyan-500",
  cash: "bg-emerald-500",
  other: "bg-slate-500",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-rose-50 text-rose-600",
  settled: "bg-blue-50 text-blue-600",
  active: "bg-emerald-50 text-emerald-600",
  completed: "bg-slate-100 text-slate-600",
};

interface Mission {
  id: string;
  name: string;
  address: string;
  mission_with: string;
  details: string;
  start_date: string;
  end_date: string | null;
  status: string;
  user_id: string;
  created_at: string;
  user_name?: string;
}

interface Expense {
  id: string;
  mission_id: string | null;
  date: string;
  category: string;
  description: string;
  amount: number;
  image_url: string | null;
  status: string;
}

export default function AdminJournalLogbook() {
  const { role } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUser, setFilterUser] = useState("all");
  const [filterMission, setFilterMission] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  // Expand states
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [missRes, expRes, profRes] = await Promise.all([
      supabase.from("missions").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: true }),
      supabase.from("profiles").select("id, name, email"),
    ]);

    const profs = profRes.data || [];
    const missionsWithUser = (missRes.data || []).map(m => ({
      ...m,
      user_name: profs.find(p => p.id === m.user_id)?.name || "Unknown",
    }));

    setMissions(missionsWithUser);
    setExpenses(expRes.data || []);
    setProfiles(profs);
    setLoading(false);
  };

  // Unique users from missions
  const uniqueUsers = useMemo(() => {
    return Array.from(new Map(profiles.map(p => [p.id, p])).values());
  }, [profiles]);

  // Filtered missions based on dropdown
  const filteredMissionDropdown = useMemo(() => {
    if (filterUser === "all") return missions;
    return missions.filter(m => m.user_id === filterUser);
  }, [missions, filterUser]);

  // Main filtered missions
  const filteredMissions = useMemo(() => {
    let result = missions;

    // Default: show active missions of all users
    if (filterUser === "all" && filterMission === "all" && !filterDate) {
      return result.filter(m => m.status === "active" || m.status === "pending");
    }

    // When user is selected: show active + completed
    if (filterUser !== "all") {
      result = result.filter(m => m.user_id === filterUser);
    }

    if (filterMission !== "all") {
      result = result.filter(m => m.id === filterMission);
    }

    return result;
  }, [missions, filterUser, filterMission, filterDate]);

  const getExpensesForMission = (missionId: string) => {
    let exps = expenses.filter(e => e.mission_id === missionId);
    if (filterDate) {
      exps = exps.filter(e => e.date === filterDate);
    }
    return exps;
  };

  const groupByDate = (items: Expense[]) => {
    const grouped: Record<string, Expense[]> = {};
    items.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  };

  const toggleMission = (id: string) => {
    setExpandedMissions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDate = (key: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const formatDateStr = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  };

  if (role !== "admin") {
    return <div className="text-center py-10 text-[10px] font-black text-destructive uppercase">Access Denied</div>;
  }

  if (loading) {
    return <div className="text-center py-10 text-[10px] font-black text-muted-foreground uppercase animate-pulse">Loading Journal...</div>;
  }

  const renderExpenseEntry = (entry: Expense) => {
    const isOpen = expandedEntry === entry.id;
    return (
      <div key={entry.id} className="border-t border-gray-50 first:border-t-0">
        <button
          onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
          className="w-full py-3 flex justify-between items-center hover:bg-gray-50 text-left px-1"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CATEGORY_DOT_COLORS[entry.category] || "bg-slate-400"}`} />
            <span className="text-[10px] font-bold text-gray-800 truncate uppercase">{entry.description || "No Detail"}</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className={`text-[10px] font-black ${entry.category === "cash" ? "text-emerald-600" : "text-gray-700"}`}>
              ₹{Number(entry.amount).toLocaleString()}
            </span>
            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        {isOpen && (
          <div className="pb-3 px-1">
            <div className="bg-white p-2.5 rounded-xl border border-gray-100 flex gap-3 shadow-sm">
              <div className="relative flex-shrink-0">
                {entry.image_url ? (
                  <div className="relative w-14 h-14">
                    <img src={entry.image_url} className="w-full h-full rounded-lg object-cover border" alt="receipt" />
                    <button
                      onClick={() => setPreviewImage(entry.image_url)}
                      className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-50 flex flex-col items-center justify-center border border-dashed border-gray-200">
                    <Camera className="w-4 h-4 text-gray-300" />
                    <span className="text-[6px] font-bold text-gray-300 mt-1">NO IMAGE</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div className="flex justify-between items-start">
                  <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${STATUS_BADGES[entry.status] || "bg-gray-100 text-gray-500"}`}>
                    {entry.status}
                  </span>
                  <span className="text-[8px] font-black text-gray-400 uppercase">{entry.category}</span>
                </div>
                <p className="text-[9px] text-gray-400 font-medium italic mt-2">
                  {entry.status === "approved" || entry.status === "settled" ? "Verification Complete" : "Pending Review"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMissionCard = (mission: Mission) => {
    const missionExpenses = getExpensesForMission(mission.id);
    const dateGroups = groupByDate(missionExpenses);
    const missionTotal = missionExpenses.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);
    const cashTotal = missionExpenses.filter(e => e.category === "cash").reduce((s, e) => s + Number(e.amount), 0);
    const isExpanded = expandedMissions.has(mission.id);
    const isActive = mission.status === "active" || mission.status === "pending";

    return (
      <div key={mission.id} className="bg-white rounded-[1.8rem] border border-gray-100 overflow-hidden animate-fade-in mb-3 shadow-sm">
        <button
          onClick={() => toggleMission(mission.id)}
          className="w-full p-4 bg-gray-50/50 border-b border-gray-50 text-left hover:bg-gray-100/50 transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <div>
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight">{mission.name}</h4>
                <p className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">{mission.user_name}</p>
                {mission.address && (
                  <p className="text-[8px] text-gray-400 font-bold flex items-center gap-0.5 mt-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {mission.address}
                  </p>
                )}
                {mission.mission_with && (
                  <p className="text-[8px] text-gray-400 font-bold flex items-center gap-0.5">
                    <UsersIcon className="w-2.5 h-2.5" /> {mission.mission_with}
                  </p>
                )}
                <p className="text-[8px] text-gray-400 font-bold mt-0.5">
                  {formatDateStr(mission.start_date)}{mission.end_date ? ` → ${formatDateStr(mission.end_date)}` : " → Ongoing"}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-black text-gray-900">₹{missionTotal.toLocaleString()}</p>
              {cashTotal > 0 && <p className="text-[9px] font-bold text-emerald-600">+₹{cashTotal.toLocaleString()} cash</p>}
              <div className="flex gap-1.5 mt-1 justify-end">
                <span className="text-[7px] bg-gray-100 px-2 py-0.5 rounded-full font-black text-gray-500">{missionExpenses.length} entries</span>
                <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${STATUS_BADGES[mission.status] || "bg-gray-100 text-gray-500"}`}>
                  {mission.status}
                </span>
              </div>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div>
            {/* Mission Details */}
            {mission.details && (
              <div className="px-5 pt-3 pb-1">
                <div className="flex items-start gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                  <FileText className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[9px] text-gray-600 font-medium leading-relaxed">{mission.details}</p>
                </div>
              </div>
            )}

            {/* Mission Gallery */}
            <div className="px-5 pb-2">
              <MissionGallery missionId={mission.id} userId={mission.user_id} isActive={false} />
            </div>

            {/* Expense entries */}
            <div className="divide-y divide-gray-50">
              {dateGroups.length === 0 && (
                <p className="text-center text-gray-400 text-[10px] italic py-6">No entries found</p>
              )}
              {dateGroups.map(([date, entries]) => {
                const dateKey = `admin_${mission.id}_${date}`;
                const isDateOpen = expandedDates.has(dateKey);
                const dayTotal = entries.filter(e => e.category !== "cash").reduce((s, e) => s + Number(e.amount), 0);

                return (
                  <div key={dateKey}>
                    <button
                      onClick={() => toggleDate(dateKey)}
                      className="w-full px-5 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isDateOpen ? <ChevronDown className="w-3 h-3 text-blue-500" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">
                          {formatDateStr(date)}
                        </span>
                        <span className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded-full font-bold text-gray-400">
                          {entries.length}
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-gray-800">₹{dayTotal.toLocaleString()}</span>
                    </button>
                    {isDateOpen && (
                      <div className="px-4 pb-3 space-y-1">
                        {entries.map(entry => renderExpenseEntry(entry))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24 px-1">
      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 italic">Journal Filters</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* User Filter */}
          <div className="group space-y-1">
            <label className="text-[7px] font-black uppercase text-gray-400 ml-1">User</label>
            <div className="relative">
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setFilterMission("all"); // Reset mission when user changes
                }}
                className="w-full bg-gray-50/50 border border-transparent p-2 rounded-xl text-[9px] font-black uppercase outline-none appearance-none focus:bg-white focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <User className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-300 pointer-events-none" />
            </div>
          </div>

          {/* Mission Filter */}
          <div className="group space-y-1">
            <label className="text-[7px] font-black uppercase text-gray-400 ml-1">Mission</label>
            <div className="relative">
              <select
                value={filterMission}
                onChange={(e) => setFilterMission(e.target.value)}
                className="w-full bg-gray-50/50 border border-transparent p-2 rounded-xl text-[9px] font-black uppercase outline-none appearance-none focus:bg-white focus:ring-2 focus:ring-purple-500/10"
              >
                <option value="all">All Missions</option>
                {filteredMissionDropdown.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.user_name})</option>
                ))}
              </select>
              <Target className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-300 pointer-events-none" />
            </div>
          </div>

          {/* Date Filter */}
          <div className="group space-y-1">
            <label className="text-[7px] font-black uppercase text-gray-400 ml-1">Date</label>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-gray-50/50 border border-transparent p-2 rounded-xl text-[9px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex justify-between items-center px-2">
        <span className="text-[8px] font-black uppercase opacity-30 tracking-[0.2em]">{filteredMissions.length} Missions</span>
        {(filterUser !== "all" || filterMission !== "all" || filterDate) && (
          <button
            onClick={() => { setFilterUser("all"); setFilterMission("all"); setFilterDate(""); }}
            className="text-[8px] font-black text-blue-500 uppercase underline active:opacity-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Mission Cards */}
      {filteredMissions.length === 0 ? (
        <div className="text-center py-10 opacity-20 font-black text-[10px] uppercase italic tracking-widest">
          No Missions Found
        </div>
      ) : (
        filteredMissions.map(m => renderMissionCard(m))
      )}

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}

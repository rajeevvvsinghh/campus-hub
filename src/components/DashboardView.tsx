import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  GraduationCap,
  Megaphone,
  Plus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCampus } from '../context/CampusContext';
import { analyzeAttendance } from '../lib/attendanceMath';
import { SemesterOverview } from './SemesterOverview';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DashboardView: React.FC = () => {
  const [dashboardTab, setDashboardTab] = useState<'all' | 'semester' | 'daily'>('all');
  const {
    profile,
    activeRoleView,
    isDemoMode,
    setActiveView,
    timetable,
    attendanceRecords,
    exams,
    studyTasks,
    toggleStudyTask,
    materials,
    bookmarks,
    announcements,
    platformSettings,
    seedSampleWorkspace,
    openAiWithMaterial,
    colorPalette,
    setColorPalette,
  } = useCampus();

  const [seeding, setSeeding] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 1 : today; // Default Monday if Sunday
  });

  const requiredPct = profile?.targetAttendance || platformSettings.defaultRequiredAttendance || 75;

  const myAttendance = useMemo(() => {
    if (!profile) return [];
    return attendanceRecords.filter((r) => r.studentUid === profile.uid);
  }, [attendanceRecords, profile]);

  const overallStats = useMemo(() => {
    const attended = myAttendance.reduce((sum, r) => sum + r.classesAttended, 0);
    const total = myAttendance.reduce((sum, r) => sum + r.totalClasses, 0);
    const analysis = analyzeAttendance(attended, total, requiredPct);
    const shortages = myAttendance.filter(
      (r) => !analyzeAttendance(r.classesAttended, r.totalClasses, requiredPct).isMeetingTarget
    ).length;
    return { attended, total, ...analysis, shortages };
  }, [myAttendance, requiredPct]);

  const todaysClasses = useMemo(() => {
    return timetable
      .filter((slot) => slot.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetable, selectedDay]);

  const upcomingExams = useMemo(() => {
    return [...exams]
      .sort((a, b) => a.examDate.localeCompare(b.examDate))
      .slice(0, 4);
  }, [exams]);

  const pendingAssignments = useMemo(() => {
    return studyTasks.filter((t) => !t.completed).slice(0, 5);
  }, [studyTasks]);

  const studyProgress = useMemo(() => {
    const total = studyTasks.length;
    const done = studyTasks.filter((t) => t.completed).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [studyTasks]);

  const chartData = useMemo(() => {
    return myAttendance.map((rec) => ({
      code: rec.subjectCode,
      percentage: analyzeAttendance(rec.classesAttended, rec.totalClasses, requiredPct).currentPercentage,
      target: requiredPct,
    }));
  }, [myAttendance, requiredPct]);

  const recentMaterials = useMemo(() => {
    if (bookmarks.length === 0) return materials.slice(0, 4);
    const viewedIds = new Set(bookmarks.map((b) => b.materialId));
    const viewed = materials.filter((m) => viewedIds.has(m.id));
    const rest = materials.filter((m) => !viewedIds.has(m.id));
    return [...viewed, ...rest].slice(0, 4);
  }, [materials, bookmarks]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedSampleWorkspace();
    } finally {
      setSeeding(false);
    }
  };

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Completed';
    if (diff === 0) return 'Today';
    return `${diff}d left`;
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Header */}
      <section className="relative overflow-hidden cc-card p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="absolute inset-0 cc-grid-pattern opacity-45 pointer-events-none" aria-hidden="true" />
        <div className="relative z-10 space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {profile?.courseName || 'B.Tech Computer Science'} · Semester {profile?.semester || 5} ·{' '}
            {platformSettings.academicYear} · {isDemoMode ? 'Sample Workspace' : 'Cloud Account'}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
            Welcome back, {profile?.displayName || 'Student'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {activeRoleView === 'student'
              ? 'Track today’s classes, monitor attendance margins, browse notes, textbooks & syllabi, and ask Gemini AI about your study materials.'
              : activeRoleView === 'faculty'
              ? 'Manage subject notes, books, and syllabi, publish class announcements, and update official student attendance records.'
              : 'Oversee departments, subjects, user roles, examination timetables, and institution-wide academic rules.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          {!isDemoMode && myAttendance.length === 0 && studyTasks.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              {seeding ? 'Loading Sample Data...' : 'Load Sample Academic Data'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('ai-solver')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap shadow-xs"
          >
            <Bot className="w-4 h-4" />
            Ask AI Doubt Solver
          </button>
          <button
            type="button"
            onClick={() => setActiveView('materials')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#141925] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-sm font-medium transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Browse Library
          </button>
        </div>
      </section>

      {/* Dynamic Quick Stats Widgets: GPA Trend, Pending Task Deadlines, Daily Class Streak */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPA Trend Card */}
        <div
          onClick={() => setDashboardTab('semester')}
          className="cc-card-hover p-4 sm:p-5 cursor-pointer space-y-3"
          title="Click to view Semester Overview & GPA Trajectory"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">GPA Trend &amp; Standing</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
              <ArrowUpRight className="w-3 h-3" /> +0.14 vs last sem
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">3.88 <span className="text-xs font-normal text-slate-500">/ 4.0</span></p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dean’s Honor Roll Standing</p>
            </div>
            <div className="w-12 h-12 rounded-full cc-inset flex items-center justify-center font-mono font-bold text-xs text-[var(--cc-accent)]">
              A+
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--cc-accent)] rounded-full" style={{ width: '92%' }} />
          </div>
        </div>

        {/* Pending Task Deadlines Card */}
        <div
          onClick={() => setActiveView('exam-prep')}
          className="cc-card-hover p-4 sm:p-5 cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Task Deadlines</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
              pendingAssignments.length > 0 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
            }`}>
              {pendingAssignments.length} urgent tasks
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                {pendingAssignments.length} <span className="text-xs font-normal text-slate-500">in queue</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]">
                {pendingAssignments[0]?.title || 'All revision tasks completed!'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 font-mono text-xs font-semibold">
              {studyProgress.pct}%
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${studyProgress.pct}%` }} />
          </div>
        </div>

        {/* Daily Class Streak Card */}
        <div
          onClick={() => setActiveView('attendance')}
          className="cc-card-hover p-4 sm:p-5 cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily Study Streak</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-[var(--cc-accent)]">
              🔥 14 Days Active
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                14 <span className="text-xs font-normal text-slate-500">Days</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Consistent attendance &amp; study</p>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div
                  key={d}
                  className={`w-3.5 h-6 rounded-sm ${
                    d <= 6 ? 'bg-[var(--cc-accent)]' : 'bg-slate-200 dark:bg-white/[0.1]'
                  }`}
                  title={`Day ${d}: Active`}
                />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Next milestone: 21-day study badge unlocked soon.
          </p>
        </div>
      </section>

      {/* Dashboard View Mode Selector */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="flex items-center gap-1 cc-segmented self-start">
          <button
            type="button"
            onClick={() => setDashboardTab('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              dashboardTab === 'all'
                ? 'bg-white dark:bg-[#0B1018] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Dashboard
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('semester')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              dashboardTab === 'semester'
                ? 'bg-white dark:bg-[#0B1018] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[var(--cc-accent)]" />
            Semester Overview
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('daily')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              dashboardTab === 'daily'
                ? 'bg-white dark:bg-[#0B1018] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Daily Feed &amp; Schedule
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Smart Theme Engine Palette Quick Switcher */}
          <div
            className="flex items-center gap-1.5 cc-segmented px-2 py-1"
            title="Smart Theme Engine: Switch Emerald, Violet, Slate or Blue"
          >
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 mr-0.5">
              Theme
            </span>
            {(
              [
                { id: 'emerald', label: 'Emerald', color: '#059669' },
                { id: 'violet', label: 'Violet', color: '#7C3AED' },
                { id: 'slate', label: 'Slate', color: '#475569' },
                { id: 'blue', label: 'Blue', color: '#2563EB' },
              ] as const
            ).map((p) => {
              const isSelected = colorPalette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setColorPalette(p.id)}
                  aria-label={`${p.label} theme palette`}
                  title={`${p.label} Palette`}
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'scale-110 ring-2 ring-[var(--cc-accent)] ring-offset-2 ring-offset-white dark:ring-offset-[#0B0E16]'
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.color }}
                >
                  {isSelected && <span className="w-1 h-1 rounded-full bg-white shadow-xs" />}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 hidden lg:block">
            Showing:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {dashboardTab === 'all'
                ? 'Complete Academic Hub & Overview'
                : dashboardTab === 'semester'
                ? `Semester ${profile?.semester || 5} Performance & GPA Trajectory`
                : 'Today’s Timetable, Attendance & Tasks'}
            </span>
          </p>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip */}
      {dashboardTab !== 'semester' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveView('attendance')}
            className="text-left cc-card-hover p-5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Overall Attendance</span>
              <div className="w-8 h-8 rounded-lg bg-[var(--cc-accent-light)] border border-[var(--cc-accent-subtle)] flex items-center justify-center text-[var(--cc-accent)] transition-colors">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {overallStats.total > 0 ? `${overallStats.currentPercentage}%` : '—'}
              </span>
              <span
                className={`text-xs font-medium ${
                  overallStats.total === 0
                    ? 'text-slate-400'
                    : overallStats.isMeetingTarget
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {overallStats.total === 0
                  ? 'No records'
                  : overallStats.isMeetingTarget
                  ? `On Track (Target ${requiredPct}%)`
                  : `${overallStats.shortages} Subject Shortage`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
              {overallStats.attended} / {overallStats.total} classes attended
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('exam-prep')}
            className="text-left cc-card-hover p-5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Next Examination</span>
              <div className="w-8 h-8 rounded-lg bg-[var(--cc-accent-light)] border border-[var(--cc-accent-subtle)] flex items-center justify-center text-[var(--cc-accent)] transition-colors">
                <CalendarClock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {upcomingExams[0] ? daysUntil(upcomingExams[0].examDate) : 'None'}
              </span>
              <span className="text-xs font-medium text-[var(--cc-accent)] font-mono">
                {upcomingExams[0]?.subjectCode || '—'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {upcomingExams[0]
                ? `${upcomingExams[0].subjectName} · ${upcomingExams[0].examDate}`
                : 'No exams scheduled'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('exam-prep')}
            className="text-left cc-card-hover p-5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Study & Syllabus Progress</span>
              <div className="w-8 h-8 rounded-lg bg-[var(--cc-accent-light)] border border-[var(--cc-accent-subtle)] flex items-center justify-center text-[var(--cc-accent)] transition-colors">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">{studyProgress.pct}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {studyProgress.done}/{studyProgress.total} completed
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-[var(--cc-accent)] rounded-full transition-all duration-300"
                style={{ width: `${studyProgress.pct}%` }}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('materials')}
            className="text-left cc-card-hover p-5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Study Material Library</span>
              <div className="w-8 h-8 rounded-lg bg-[var(--cc-accent-light)] border border-[var(--cc-accent-subtle)] flex items-center justify-center text-[var(--cc-accent)] transition-colors">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">{materials.length}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {bookmarks.filter((b) => b.isBookmarked).length} bookmarked
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Notes, books, syllabus, PYQs & slides
            </p>
          </button>
        </section>
      )}

      {/* Semester Overview Component */}
      {(dashboardTab === 'semester' || dashboardTab === 'all') && (
        <SemesterOverview />
      )}

      {/* Main Content Split: Timetable + Attendance Analytics */}
      {dashboardTab !== 'semester' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Today's Classes & Schedule */}
        <section className="xl:col-span-5 cc-card p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h3 className="font-display text-base font-semibold">Today’s Classes & Schedule</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {DAY_NAMES[selectedDay]} · Semester {profile?.semester || 5}
              </p>
            </div>
            <div className="flex items-center gap-1 cc-segmented">
              {[1, 2, 3, 4, 5].map((dayIdx) => (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => setSelectedDay(dayIdx)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedDay === dayIdx
                      ? 'bg-white dark:bg-[#0B1018] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {DAY_NAMES[dayIdx].slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3 flex-1">
            {todaysClasses.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No scheduled lectures on {DAY_NAMES[selectedDay]}. Use this slot for self-study or revision.
              </div>
            ) : (
              todaysClasses.map((slot) => (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                      {slot.startTime} – {slot.endTime} · {slot.room}
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate mt-0.5">
                      {slot.subjectCode} · {slot.subjectName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {slot.instructor} {slot.isDemo ? '· Sample Schedule' : '· Official'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('attendance')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#141925] hover:bg-slate-100 dark:hover:bg-white/[0.08] shrink-0 transition-colors"
                  >
                    Log
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Subject-wise Attendance Overview Chart */}
        <section className="xl:col-span-7 cc-card p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h3 className="font-display text-base font-semibold">Subject Attendance Overview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current attendance vs {requiredPct}% institution target
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('attendance')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cc-accent)] hover:underline whitespace-nowrap"
            >
              Open Tracker <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {chartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No personal attendance subjects tracked yet.
              </p>
              <button
                type="button"
                onClick={() => setActiveView('attendance')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--cc-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subject Attendance
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0E121B',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="percentage" name="Attendance %" fill="var(--cc-accent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {overallStats.shortages > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {overallStats.shortages} subject(s) currently below the {requiredPct}% minimum requirement.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('attendance')}
                    className="font-semibold text-amber-900 dark:text-amber-200 hover:underline whitespace-nowrap"
                  >
                    Calculate Recovery
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Bottom 3-Column Row: Pending Tasks, Upcoming Exams + Announcements, Recent Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Assignments & Study Goals */}
        <section className="cc-card p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.06]">
            <h3 className="font-display text-base font-semibold">Pending Assignments & Goals</h3>
            <button
              type="button"
              onClick={() => setActiveView('exam-prep')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="mt-3.5 space-y-2">
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No pending tasks or assignments. Add study goals in Exam Prep.
              </p>
            ) : (
              pendingAssignments.map((task) => (
                <label
                  key={task.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleStudyTask(task)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {task.subjectName} · {task.category} · Due {task.dueDate || 'Soon'}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </section>

        {/* Recently Uploaded & Viewed Notes */}
        <section className="cc-card p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.06]">
            <h3 className="font-display text-base font-semibold">Recent Study Materials</h3>
            <button
              type="button"
              onClick={() => setActiveView('materials')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="mt-3.5 space-y-3">
            {recentMaterials.map((mat) => {
              const typeText =
                mat.type === 'books'
                  ? 'Book'
                  : mat.type === 'syllabus'
                  ? 'Syllabus'
                  : mat.type === 'pyq'
                  ? 'PYQ'
                  : mat.type === 'slides'
                  ? 'Slides'
                  : mat.type === 'assignment'
                  ? 'Assignment'
                  : 'Notes';
              return (
                <div
                  key={mat.id}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.02] flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {mat.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {mat.subjectName} · {typeText} · {mat.isDemo ? 'Sample' : 'Official'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAiWithMaterial(mat)}
                    title="Ask AI Doubt Solver about this material"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-blue-600 hover:text-white text-xs font-medium transition-colors shrink-0"
                  >
                    Ask AI
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upcoming Exams & Announcements */}
        <section className="cc-card p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className="font-display text-base font-semibold">Upcoming Exams</h3>
              <button
                type="button"
                onClick={() => setActiveView('exam-prep')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Timetable
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {upcomingExams.slice(0, 3).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between text-xs py-1.5">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {ex.subjectCode} · {ex.subjectName}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {ex.examDate} · {ex.startTime} · {ex.venue}
                    </p>
                  </div>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                    {daysUntil(ex.examDate)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center justify-between pb-2.5">
              <h3 className="font-display text-sm font-semibold flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                College Announcements
              </h3>
              <button
                type="button"
                onClick={() => setActiveView('announcements')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                All Notices
              </button>
            </div>
            <div className="space-y-2.5">
              {announcements.slice(0, 2).map((ann) => (
                <div key={ann.id} className="text-xs space-y-0.5">
                  <p className="font-medium text-slate-900 dark:text-white line-clamp-1">
                    {ann.title}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{ann.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  )}
</div>
);
};

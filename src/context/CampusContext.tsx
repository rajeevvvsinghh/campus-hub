import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, testConnection } from '../lib/firebase';
import {
  adminSetUserRole,
  clearRoomWhiteboardStrokes,
  createAttendanceLog,
  deleteAnnouncement,
  deleteExam,
  deleteStudyMaterial,
  deleteStudyRoom,
  deleteStudyRoomResource,
  deleteStudyTask,
  deleteWhiteboardStroke,
  ensureAndJoinRoomParticipant,
  ensureUserProfile,
  incrementStudyContributorStat,
  leaveStudyRoomParticipant,
  makeSafeId,
  saveAiChatSession,
  saveAnnouncement,
  saveAttendanceRecord,
  saveDepartment,
  saveExam,
  savePlatformSettings,
  saveStudyMaterial,
  saveStudyRoom,
  saveStudyRoomResource,
  saveStudyTask,
  saveSubject,
  saveWhiteboardStroke,
  seedInstitutionCatalogData,
  seedPersonalWorkspaceData,
  subscribeCollection,
  updateUserProfile,
  uploadMaterialFile,
  upsertBookmark,
  upsertStudyPresence,
} from '../services/campusService';
import {
  buildSampleAttendance,
  buildSampleAttendanceLogs,
  buildSampleStudyTasks,
  DEFAULT_PLATFORM_SETTINGS,
  SAMPLE_ANNOUNCEMENTS,
  SAMPLE_DEPARTMENTS,
  SAMPLE_EXAMS,
  SAMPLE_MATERIALS,
  SAMPLE_STUDY_CONTRIBUTORS,
  SAMPLE_STUDY_ROOMS,
  SAMPLE_SUBJECTS,
  SAMPLE_TIMETABLE,
} from '../data/sampleData';
import type {
  ActiveView,
  AiChatSession,
  Announcement,
  AttendanceLog,
  AttendanceRecord,
  Department,
  ExamSchedule,
  PlatformSetting,
  StudentRosterEntry,
  StudyContributorStat,
  StudyMaterial,
  StudyPresence,
  StudyRoom,
  StudyRoomParticipant,
  StudyRoomResource,
  StudyTask,
  Subject,
  TimetableSlot,
  UserBookmark,
  UserProfile,
  UserRole,
  WhiteboardStroke,
} from '../types/campus';
import { analyzeAttendance } from '../lib/attendanceMath';

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'urgent';
  targetView: ActiveView;
}

interface CampusContextValue {
  // Auth & Mode
  firebaseUser: User | null;
  authReady: boolean;
  isDemoMode: boolean;
  isEmailUnverified: boolean;
  profile: UserProfile | null;
  activeRoleView: UserRole;
  setActiveRoleView: (role: UserRole) => void;
  enterDemoMode: (role?: UserRole) => void;
  exitDemoMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  logout: () => Promise<void>;

  // Navigation & Theme
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  colorPalette: 'blue' | 'emerald' | 'violet' | 'slate';
  setColorPalette: (palette: 'blue' | 'emerald' | 'violet' | 'slate') => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  aiPrefillMaterial: StudyMaterial | null;
  openAiWithMaterial: (material: StudyMaterial) => void;
  materialUploadRequested: boolean;
  openMaterialUploader: () => void;
  clearMaterialUploadRequest: () => void;

  // Data Collections
  departments: Department[];
  subjects: Subject[];
  materials: StudyMaterial[];
  bookmarks: UserBookmark[];
  attendanceRecords: AttendanceRecord[];
  attendanceLogs: AttendanceLog[];
  exams: ExamSchedule[];
  studyTasks: StudyTask[];
  announcements: Announcement[];
  timetable: TimetableSlot[];
  aiChats: AiChatSession[];
  platformSettings: PlatformSetting;
  allUsers: UserProfile[];
  studentRoster: StudentRosterEntry[];
  studyRooms: StudyRoom[];
  studyPresenceList: StudyPresence[];
  studyContributors: StudyContributorStat[];
  notifications: NotificationItem[];
  readNotificationIds: string[];
  markAllNotificationsRead: () => void;

  // Actions
  seedSampleWorkspace: () => Promise<void>;
  saveProfileChanges: (updates: Partial<Pick<UserProfile, 'displayName' | 'departmentId' | 'courseName' | 'semester' | 'rollNumber' | 'avatarUrl' | 'targetAttendance'>>) => Promise<void>;
  toggleBookmarkMaterial: (materialId: string) => Promise<void>;
  recordMaterialView: (materialId: string) => Promise<void>;
  uploadAndCreateMaterial: (payload: {
    title: string;
    description: string;
    type: StudyMaterial['type'];
    departmentId: string;
    courseName: string;
    semester: number;
    subjectId: string;
    subjectName: string;
    unit: string;
    isOfficial: boolean;
    file?: File | null;
    contentPreview: string;
    onProgress?: (percent: number) => void;
  }) => Promise<{ storageUsed: boolean; storageError?: string; materialId: string; fileUrl: string }>;
  removeMaterial: (id: string) => Promise<void>;
  markAttendanceQuick: (record: AttendanceRecord, status: 'present' | 'absent', note?: string) => Promise<void>;
  upsertAttendanceSubject: (payload: {
    id?: string;
    studentUid: string;
    studentName: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    classesAttended: number;
    totalClasses: number;
    recordType: 'personal' | 'official';
  }) => Promise<void>;
  toggleStudyTask: (task: StudyTask) => Promise<void>;
  createOrUpdateStudyTask: (task: Omit<StudyTask, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDemo'> & { id?: string }) => Promise<void>;
  removeStudyTask: (taskId: string) => Promise<void>;
  publishAnnouncement: (payload: { title: string; body: string; category: Announcement['category']; departmentId: string; isPinned: boolean }) => Promise<void>;
  removeAnnouncementItem: (id: string) => Promise<void>;
  createExamSchedule: (payload: Omit<ExamSchedule, 'id' | 'isDemo' | 'createdByUid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  removeExamSchedule: (id: string) => Promise<void>;
  createDepartmentItem: (payload: { name: string; code: string; courses: string[]; semestersCount: number }) => Promise<void>;
  createSubjectItem: (payload: { code: string; name: string; departmentId: string; courseName: string; semester: number; credits: number; facultyName: string; units: string[] }) => Promise<void>;
  updatePlatformConfig: (payload: Omit<PlatformSetting, 'id' | 'updatedByUid' | 'updatedAt'>) => Promise<void>;
  changeUserRole: (targetUid: string, role: UserRole, deptId: string) => Promise<void>;
  persistAiChat: (session: AiChatSession, isNew: boolean) => Promise<void>;
  createStudyRoomItem: (payload: { title: string; topic: string; subjectId: string; subjectCode: string; subjectName: string; semester: number }) => Promise<StudyRoom | null>;
  removeStudyRoomItem: (roomId: string) => Promise<void>;
  publishMyStudyPresence: (payload: { subjectId: string; subjectCode: string; subjectName: string; roomId: string; roomTitle: string; studyGoal: string; isActive: boolean }) => Promise<void>;
  joinStudyRoomInFirestore: (room: StudyRoom, participant: Omit<StudyRoomParticipant, 'joinedAt' | 'lastActiveAt'>) => Promise<void>;
  leaveStudyRoomInFirestore: (roomId: string) => Promise<void>;
  persistRoomStroke: (stroke: Omit<WhiteboardStroke, 'createdAt'>) => Promise<void>;
  removeRoomStroke: (roomId: string, strokeId: string) => Promise<void>;
  clearRoomStrokesInFirestore: (roomId: string, isHostOrAdmin: boolean) => Promise<void>;
  recordStudyContribution: (payload: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    minutesDelta?: number;
    resourcesDelta?: number;
    sessionsDelta?: number;
  }) => Promise<void>;
  persistRoomResource: (resource: Omit<StudyRoomResource, 'createdAt'>) => Promise<void>;
  removeRoomResource: (roomId: string, resourceId: string) => Promise<void>;
}

const CampusContext = createContext<CampusContextValue | null>(null);

export const CampusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRoleView, setActiveRoleView] = useState<UserRole>('student');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [aiPrefillMaterial, setAiPrefillMaterial] = useState<StudyMaterial | null>(null);
  const [materialUploadRequested, setMaterialUploadRequested] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campusconnect_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  // Live or Demo datasets
  const [departments, setDepartments] = useState<Department[]>(SAMPLE_DEPARTMENTS);
  const [subjects, setSubjects] = useState<Subject[]>(SAMPLE_SUBJECTS);
  const [materials, setMaterials] = useState<StudyMaterial[]>(SAMPLE_MATERIALS);
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [exams, setExams] = useState<ExamSchedule[]>(SAMPLE_EXAMS);
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SAMPLE_ANNOUNCEMENTS);
  const [timetable, setTimetable] = useState<TimetableSlot[]>(SAMPLE_TIMETABLE);
  const [aiChats, setAiChats] = useState<AiChatSession[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting>(DEFAULT_PLATFORM_SETTINGS);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [studentRoster, setStudentRoster] = useState<StudentRosterEntry[]>([]);
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>(SAMPLE_STUDY_ROOMS);
  const [studyPresenceList, setStudyPresenceList] = useState<StudyPresence[]>([]);
  const [studyContributors, setStudyContributors] = useState<StudyContributorStat[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('campusconnect_theme', theme);
  }, [theme]);

  const [colorPalette, setColorPaletteState] = useState<'blue' | 'emerald' | 'violet' | 'slate'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campusconnect_palette');
      if (saved === 'blue' || saved === 'emerald' || saved === 'violet' || saved === 'slate') return saved;
    }
    return 'blue';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-palette', colorPalette);
    localStorage.setItem('campusconnect_palette', colorPalette);

    const paletteMap: Record<string, { accent: string; hover: string; light: string; subtle: string; rgb: string }> = {
      emerald: {
        accent: '#059669',
        hover: '#047857',
        light: theme === 'dark' ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
        subtle: 'rgba(5, 150, 105, 0.15)',
        rgb: '5, 150, 105',
      },
      violet: {
        accent: '#7C3AED',
        hover: '#6D28D9',
        light: theme === 'dark' ? 'rgba(124, 58, 237, 0.2)' : '#F5F3FF',
        subtle: 'rgba(124, 58, 237, 0.15)',
        rgb: '124, 58, 237',
      },
      slate: {
        accent: '#475569',
        hover: '#334155',
        light: theme === 'dark' ? 'rgba(71, 85, 105, 0.25)' : '#F8FAFC',
        subtle: 'rgba(71, 85, 105, 0.15)',
        rgb: '71, 85, 105',
      },
      blue: {
        accent: '#2563EB',
        hover: '#1D4ED8',
        light: theme === 'dark' ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
        subtle: 'rgba(37, 99, 235, 0.15)',
        rgb: '37, 99, 235',
      },
    };

    const p = paletteMap[colorPalette] || paletteMap.blue;
    root.style.setProperty('--cc-accent', p.accent);
    root.style.setProperty('--cc-accent-hover', p.hover);
    root.style.setProperty('--cc-accent-light', p.light);
    root.style.setProperty('--cc-accent-subtle', p.subtle);
    root.style.setProperty('--cc-accent-rgb', p.rgb);
  }, [colorPalette, theme]);

  const setColorPalette = (palette: 'blue' | 'emerald' | 'violet' | 'slate') => {
    setColorPaletteState(palette);
  };

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsDemoMode(false);
        if (user.emailVerified) {
          try {
            const p = await ensureUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Student',
              avatarUrl: user.photoURL || '',
            });
            setProfile(p);
            setActiveRoleView(p.role);
          } catch (err) {
            console.error('Error initializing profile:', err);
          }
        } else {
          setProfile({
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Student',
            email: user.email || '',
            role: 'student',
            departmentId: 'dept_cse',
            courseName: 'B.Tech Computer Science',
            semester: 5,
            rollNumber: 'PENDING',
            avatarUrl: user.photoURL || '',
            targetAttendance: 75,
          });
        }
      } else {
        setProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const isEmailUnverified = Boolean(firebaseUser && !firebaseUser.emailVerified);

  // Attach Firestore realtime listeners ONLY when authenticated and verified
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified || isDemoMode) {
      return;
    }

    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeCollection<Department>('departments', (items) => {
        setDepartments(items.length > 0 ? items : SAMPLE_DEPARTMENTS);
      })
    );
    unsubs.push(
      subscribeCollection<Subject>('subjects', (items) => {
        setSubjects(items.length > 0 ? items : SAMPLE_SUBJECTS);
      })
    );
    unsubs.push(
      subscribeCollection<StudyMaterial>('materials', (items) => {
        setMaterials(items.length > 0 ? items : SAMPLE_MATERIALS);
      })
    );
    unsubs.push(
      subscribeCollection<UserBookmark>('userBookmarks', (items) => {
        setBookmarks(items);
      }, 'userId', uid)
    );
    unsubs.push(
      subscribeCollection<AttendanceRecord>(
        'attendanceSubjects',
        (items) => setAttendanceRecords(items),
        profile?.role === 'student' ? 'studentUid' : undefined,
        profile?.role === 'student' ? uid : undefined
      )
    );
    unsubs.push(
      subscribeCollection<AttendanceLog>(
        'attendanceLogs',
        (items) => setAttendanceLogs(items),
        profile?.role === 'student' ? 'studentUid' : undefined,
        profile?.role === 'student' ? uid : undefined
      )
    );
    unsubs.push(
      subscribeCollection<ExamSchedule>('exams', (items) => {
        setExams(items.length > 0 ? items : SAMPLE_EXAMS);
      })
    );
    unsubs.push(
      subscribeCollection<StudyTask>('studyTasks', (items) => {
        setStudyTasks(items);
      }, 'userId', uid)
    );
    unsubs.push(
      subscribeCollection<Announcement>('announcements', (items) => {
        setAnnouncements(items.length > 0 ? items : SAMPLE_ANNOUNCEMENTS);
      })
    );
    unsubs.push(
      subscribeCollection<TimetableSlot>('timetable', (items) => {
        setTimetable(items.length > 0 ? items : SAMPLE_TIMETABLE);
      })
    );
    unsubs.push(
      subscribeCollection<AiChatSession>('aiChats', (items) => {
        setAiChats(items);
      }, 'userId', uid)
    );
    unsubs.push(
      subscribeCollection<PlatformSetting>('platformSettings', (items) => {
        if (items.length > 0) {
          setPlatformSettings(items[0]);
        }
      })
    );

    if (profile?.role === 'admin') {
      unsubs.push(subscribeCollection<UserProfile>('users', (items) => setAllUsers(items)));
    }
    if (profile?.role === 'admin' || profile?.role === 'faculty') {
      unsubs.push(subscribeCollection<StudentRosterEntry>('studentRosters', (items) => setStudentRoster(items)));
    }
    unsubs.push(
      subscribeCollection<StudyRoom>('studyRooms', (items) => {
        setStudyRooms(items.length > 0 ? items : SAMPLE_STUDY_ROOMS);
      })
    );
    unsubs.push(
      subscribeCollection<StudyPresence>('studyPresence', (items) => {
        setStudyPresenceList(items);
      })
    );
    unsubs.push(
      subscribeCollection<StudyContributorStat>('studyContributors', (items) => {
        setStudyContributors(items);
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, isDemoMode, profile?.role]);

  const enterDemoMode = (role: UserRole = 'student') => {
    const demoUid = 'demo_student_01';
    const demoName = role === 'faculty' ? 'Dr. Meera Kulkarni' : role === 'admin' ? 'Campus Administrator' : 'Aarav Sharma';
    setIsDemoMode(true);
    setProfile({
      uid: demoUid,
      displayName: demoName,
      email: role === 'faculty' ? 'meera.kulkarni@campus.edu' : role === 'admin' ? 'admin@campus.edu' : 'aarav.sharma@campus.edu',
      role,
      departmentId: 'dept_cse',
      courseName: 'B.Tech Computer Science',
      semester: 5,
      rollNumber: role === 'student' ? '24CSE1042' : 'FAC-CS09',
      avatarUrl: '/src/assets/images/avatar_student_default_1794918573501.jpg',
      targetAttendance: 75,
    });
    setActiveRoleView(role);
    setDepartments(SAMPLE_DEPARTMENTS);
    setSubjects(SAMPLE_SUBJECTS);
    setMaterials(SAMPLE_MATERIALS);
    setAttendanceRecords(buildSampleAttendance(demoUid, demoName));
    setAttendanceLogs(buildSampleAttendanceLogs(demoUid));
    setExams(SAMPLE_EXAMS);
    setStudyTasks(buildSampleStudyTasks(demoUid));
    setAnnouncements(SAMPLE_ANNOUNCEMENTS);
    setTimetable(SAMPLE_TIMETABLE);
    setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
    setStudentRoster([
      { uid: demoUid, displayName: 'Aarav Sharma', rollNumber: '24CSE1042', departmentId: 'dept_cse', courseName: 'B.Tech Computer Science', semester: 5 },
      { uid: 'demo_student_02', displayName: 'Diya Patel', rollNumber: '24CSE1018', departmentId: 'dept_cse', courseName: 'B.Tech Computer Science', semester: 5 },
      { uid: 'demo_student_03', displayName: 'Kabir Verma', rollNumber: '24CSE1075', departmentId: 'dept_cse', courseName: 'B.Tech Computer Science', semester: 5 },
    ]);
    setAllUsers([
      { uid: demoUid, displayName: 'Aarav Sharma', email: 'aarav.sharma@campus.edu', role: 'student', departmentId: 'dept_cse', courseName: 'B.Tech Computer Science', semester: 5, rollNumber: '24CSE1042', avatarUrl: '', targetAttendance: 75 },
      { uid: 'demo_faculty_01', displayName: 'Dr. Meera Kulkarni', email: 'meera.kulkarni@campus.edu', role: 'faculty', departmentId: 'dept_cse', courseName: 'Computer Science', semester: 5, rollNumber: 'FAC-CS01', avatarUrl: '', targetAttendance: 75 },
      { uid: 'demo_admin_01', displayName: 'Campus Administrator', email: 'admin@campus.edu', role: 'admin', departmentId: 'dept_cse', courseName: 'Administration', semester: 5, rollNumber: 'ADM-01', avatarUrl: '', targetAttendance: 75 },
    ]);
    setBookmarks([
      { id: `${demoUid}_mat_os_u1`, userId: demoUid, materialId: 'mat_os_u1', isBookmarked: true },
      { id: `${demoUid}_mat_dbms_u3`, userId: demoUid, materialId: 'mat_dbms_u3', isBookmarked: true },
    ]);
    setStudyRooms(SAMPLE_STUDY_ROOMS);
    setStudyPresenceList([]);
    setStudyContributors(SAMPLE_STUDY_CONTRIBUTORS);
    setActiveView('dashboard');
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    setProfile(null);
    setStudyContributors([]);
    setActiveView('dashboard');
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    const verified = auth.currentUser.emailVerified;
    if (verified) {
      const p = await ensureUserProfile({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || 'Student',
        avatarUrl: auth.currentUser.photoURL || '',
      });
      setProfile(p);
      setActiveRoleView(p.role);
    }
    return verified;
  };

  const logout = async () => {
    if (isDemoMode) {
      exitDemoMode();
      return;
    }
    await signOut(auth);
    setProfile(null);
    setActiveView('dashboard');
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const openAiWithMaterial = (material: StudyMaterial) => {
    setAiPrefillMaterial(material);
    setActiveView('ai-solver');
  };

  const openMaterialUploader = () => {
    setMaterialUploadRequested(true);
    setActiveView('materials');
  };

  const clearMaterialUploadRequest = () => {
    setMaterialUploadRequested(false);
  };

  const seedSampleWorkspace = async () => {
    if (!profile) return;
    if (isDemoMode) {
      setAttendanceRecords(buildSampleAttendance(profile.uid, profile.displayName));
      setAttendanceLogs(buildSampleAttendanceLogs(profile.uid));
      setStudyTasks(buildSampleStudyTasks(profile.uid));
      return;
    }
    await seedPersonalWorkspaceData(profile.uid, profile.displayName);
    if (profile.role === 'admin' || profile.role === 'faculty') {
      await seedInstitutionCatalogData(profile.uid, profile.role);
    }
  };

  const saveProfileChanges = async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'departmentId' | 'courseName' | 'semester' | 'rollNumber' | 'avatarUrl' | 'targetAttendance'>>
  ) => {
    if (!profile) return;
    const nextProfile = { ...profile, ...updates };
    setProfile(nextProfile);
    if (!isDemoMode) {
      await updateUserProfile(profile.uid, updates);
    }
  };

  const toggleBookmarkMaterial = async (materialId: string) => {
    if (!profile) return;
    const existing = bookmarks.find((b) => b.materialId === materialId);
    const nextBookmarked = !existing?.isBookmarked;
    if (isDemoMode) {
      setBookmarks((prev) => {
        const filtered = prev.filter((b) => b.materialId !== materialId);
        return [...filtered, { id: `${profile.uid}_${materialId}`, userId: profile.uid, materialId, isBookmarked: nextBookmarked }];
      });
      return;
    }
    await upsertBookmark({ userId: profile.uid, materialId, isBookmarked: nextBookmarked });
  };

  const recordMaterialView = async (materialId: string) => {
    if (!profile) return;
    const existing = bookmarks.find((b) => b.materialId === materialId);
    if (isDemoMode) {
      setBookmarks((prev) => {
        const filtered = prev.filter((b) => b.materialId !== materialId);
        return [
          {
            id: `${profile.uid}_${materialId}`,
            userId: profile.uid,
            materialId,
            isBookmarked: existing?.isBookmarked || false,
            lastViewedAt: new Date().toISOString(),
          },
          ...filtered,
        ];
      });
      return;
    }
    await upsertBookmark({
      userId: profile.uid,
      materialId,
      isBookmarked: existing?.isBookmarked || false,
    });
  };

  const uploadAndCreateMaterial: CampusContextValue['uploadAndCreateMaterial'] = async (payload) => {
    if (!profile) return { storageUsed: false, materialId: '', fileUrl: '' };
    const id = makeSafeId('mat');
    let fileUrl = '';
    let storageUsed = false;
    let storageError: string | undefined;
    const fileName = payload.file?.name || `${payload.title.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
    const fileSizeLabel = payload.file ? `${Math.max(1, Math.round(payload.file.size / 1024))} KB` : '240 KB';

    if (isDemoMode && payload.file) {
      payload.onProgress?.(60);
      fileUrl = URL.createObjectURL(payload.file);
      storageUsed = true;
      payload.onProgress?.(100);
    } else if (!isDemoMode && payload.file) {
      const uploaded = await uploadMaterialFile(
        payload.file,
        payload.subjectId,
        payload.departmentId,
        payload.onProgress
      );
      fileUrl = uploaded.fileUrl;
      storageUsed = uploaded.storageUsed;
      storageError = uploaded.storageError;
    }

    const newMaterial: StudyMaterial = {
      id,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      departmentId: payload.departmentId,
      courseName: payload.courseName,
      semester: payload.semester,
      subjectId: payload.subjectId,
      subjectName: payload.subjectName,
      unit: payload.unit,
      fileUrl,
      fileName,
      fileSizeLabel,
      contentPreview: payload.contentPreview || payload.description,
      uploadedByUid: profile.uid,
      uploadedByName: profile.displayName,
      isOfficial: payload.isOfficial,
      isDemo: isDemoMode,
    };

    if (isDemoMode) {
      setMaterials((prev) => [newMaterial, ...prev]);
      return { storageUsed, materialId: id, fileUrl };
    }
    await saveStudyMaterial(newMaterial);
    return { storageUsed, storageError, materialId: id, fileUrl };
  };

  const removeMaterial = async (id: string) => {
    if (isDemoMode) {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      return;
    }
    await deleteStudyMaterial(id);
  };

  const markAttendanceQuick = async (record: AttendanceRecord, status: 'present' | 'absent', note = '') => {
    if (!profile) return;
    const nextAttended = status === 'present' ? record.classesAttended + 1 : record.classesAttended;
    const nextTotal = record.totalClasses + 1;
    const updated: AttendanceRecord = {
      ...record,
      classesAttended: nextAttended,
      totalClasses: nextTotal,
      updatedByUid: profile.uid,
    };
    const logItem: AttendanceLog = {
      id: makeSafeId('attlog'),
      studentUid: record.studentUid,
      subjectId: record.subjectId,
      subjectName: record.subjectName,
      date: new Date().toISOString().slice(0, 10),
      status,
      recordType: record.recordType,
      note: note || `Marked ${status}`,
      loggedByUid: profile.uid,
    };

    if (isDemoMode) {
      setAttendanceRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      setAttendanceLogs((prev) => [logItem, ...prev]);
      return;
    }
    await saveAttendanceRecord(updated, false);
    await createAttendanceLog(logItem);
  };

  const upsertAttendanceSubject: CampusContextValue['upsertAttendanceSubject'] = async (payload) => {
    if (!profile) return;
    const isNew = !payload.id;
    const record: AttendanceRecord = {
      id: payload.id || makeSafeId('att'),
      studentUid: payload.studentUid,
      studentName: payload.studentName,
      subjectId: payload.subjectId,
      subjectCode: payload.subjectCode,
      subjectName: payload.subjectName,
      classesAttended: payload.classesAttended,
      totalClasses: payload.totalClasses,
      recordType: payload.recordType,
      isDemo: isDemoMode,
      updatedByUid: profile.uid,
    };
    if (isDemoMode) {
      setAttendanceRecords((prev) => {
        const exists = prev.some((r) => r.id === record.id);
        return exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev];
      });
      return;
    }
    await saveAttendanceRecord(record, isNew);
  };

  const toggleStudyTask = async (task: StudyTask) => {
    const updated: StudyTask = { ...task, completed: !task.completed };
    if (isDemoMode) {
      setStudyTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      return;
    }
    await saveStudyTask(updated, false);
  };

  const createOrUpdateStudyTask: CampusContextValue['createOrUpdateStudyTask'] = async (payload) => {
    if (!profile) return;
    const isNew = !payload.id;
    const task: StudyTask = {
      id: payload.id || makeSafeId('task'),
      userId: profile.uid,
      subjectId: payload.subjectId,
      subjectName: payload.subjectName,
      unit: payload.unit,
      title: payload.title,
      dueDate: payload.dueDate,
      priority: payload.priority,
      category: payload.category,
      completed: payload.completed,
      isDemo: isDemoMode,
    };
    if (isDemoMode) {
      setStudyTasks((prev) => (isNew ? [task, ...prev] : prev.map((t) => (t.id === task.id ? task : t))));
      return;
    }
    await saveStudyTask(task, isNew);
  };

  const removeStudyTask = async (taskId: string) => {
    if (isDemoMode) {
      setStudyTasks((prev) => prev.filter((t) => t.id !== taskId));
      return;
    }
    await deleteStudyTask(taskId);
  };

  const publishAnnouncement: CampusContextValue['publishAnnouncement'] = async (payload) => {
    if (!profile) return;
    const item: Announcement = {
      id: makeSafeId('ann'),
      title: payload.title,
      body: payload.body,
      category: payload.category,
      departmentId: payload.departmentId,
      authorUid: profile.uid,
      authorName: profile.displayName,
      authorRole: activeRoleView === 'admin' ? 'admin' : 'faculty',
      isPinned: payload.isPinned,
      isDemo: isDemoMode,
    };
    if (isDemoMode) {
      setAnnouncements((prev) => [item, ...prev]);
      return;
    }
    await saveAnnouncement(item);
  };

  const removeAnnouncementItem = async (id: string) => {
    if (isDemoMode) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      return;
    }
    await deleteAnnouncement(id);
  };

  const createExamSchedule: CampusContextValue['createExamSchedule'] = async (payload) => {
    if (!profile) return;
    const item: ExamSchedule = {
      ...payload,
      id: makeSafeId('exam'),
      isDemo: isDemoMode,
      createdByUid: profile.uid,
    };
    if (isDemoMode) {
      setExams((prev) => [...prev, item]);
      return;
    }
    await saveExam(item);
  };

  const removeExamSchedule = async (id: string) => {
    if (isDemoMode) {
      setExams((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    await deleteExam(id);
  };

  const createDepartmentItem: CampusContextValue['createDepartmentItem'] = async (payload) => {
    if (!profile) return;
    const item: Department = {
      id: makeSafeId('dept'),
      name: payload.name,
      code: payload.code,
      courses: payload.courses,
      semestersCount: payload.semestersCount,
      isDemo: isDemoMode,
      createdByUid: profile.uid,
    };
    if (isDemoMode) {
      setDepartments((prev) => [...prev, item]);
      return;
    }
    await saveDepartment(item);
  };

  const createSubjectItem: CampusContextValue['createSubjectItem'] = async (payload) => {
    if (!profile) return;
    const item: Subject = {
      id: makeSafeId('sub'),
      ...payload,
      isDemo: isDemoMode,
      createdByUid: profile.uid,
    };
    if (isDemoMode) {
      setSubjects((prev) => [...prev, item]);
      return;
    }
    await saveSubject(item);
  };

  const updatePlatformConfig: CampusContextValue['updatePlatformConfig'] = async (payload) => {
    if (!profile) return;
    const item: PlatformSetting = {
      id: 'default',
      ...payload,
      updatedByUid: profile.uid,
    };
    if (isDemoMode) {
      setPlatformSettings(item);
      return;
    }
    await savePlatformSettings(item);
  };

  const changeUserRole = async (targetUid: string, role: UserRole, deptId: string) => {
    if (!profile) return;
    if (isDemoMode) {
      setAllUsers((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, role } : u)));
      return;
    }
    await adminSetUserRole(targetUid, role, deptId, profile.uid);
  };

  const persistAiChat = async (session: AiChatSession, isNew: boolean) => {
    if (isDemoMode) {
      setAiChats((prev) => {
        const exists = prev.some((c) => c.id === session.id);
        return exists ? prev.map((c) => (c.id === session.id ? session : c)) : [session, ...prev];
      });
      return;
    }
    await saveAiChatSession(session, isNew);
  };

  const createStudyRoomItem: CampusContextValue['createStudyRoomItem'] = async (payload) => {
    if (!profile) return null;
    const item: StudyRoom = {
      id: makeSafeId('room'),
      title: payload.title,
      topic: payload.topic,
      subjectId: payload.subjectId,
      subjectCode: payload.subjectCode,
      subjectName: payload.subjectName,
      semester: payload.semester,
      hostUid: profile.uid,
      hostName: profile.displayName,
      isActive: true,
      isDemo: isDemoMode,
    };
    if (isDemoMode) {
      setStudyRooms((prev) => [item, ...prev]);
      return item;
    }
    await saveStudyRoom(item);
    return item;
  };

  const removeStudyRoomItem: CampusContextValue['removeStudyRoomItem'] = async (roomId) => {
    if (isDemoMode) {
      setStudyRooms((prev) => prev.filter((r) => r.id !== roomId));
      return;
    }
    await deleteStudyRoom(roomId);
  };

  const publishMyStudyPresence: CampusContextValue['publishMyStudyPresence'] = async (payload) => {
    if (!profile) return;
    const item: StudyPresence = {
      uid: profile.uid,
      displayName: profile.displayName,
      subjectId: payload.subjectId,
      subjectCode: payload.subjectCode,
      subjectName: payload.subjectName,
      roomId: payload.roomId,
      roomTitle: payload.roomTitle,
      studyGoal: payload.studyGoal,
      isActive: payload.isActive,
    };
    if (isDemoMode) {
      setStudyPresenceList((prev) => {
        const exists = prev.some((p) => p.uid === item.uid);
        return exists ? prev.map((p) => (p.uid === item.uid ? item : p)) : [item, ...prev];
      });
      return;
    }
    await upsertStudyPresence(item);
  };

  const joinStudyRoomInFirestore: CampusContextValue['joinStudyRoomInFirestore'] = async (room, participant) => {
    if (isDemoMode) return;
    await ensureAndJoinRoomParticipant({ room, participant });
  };

  const leaveStudyRoomInFirestore: CampusContextValue['leaveStudyRoomInFirestore'] = async (roomId) => {
    if (isDemoMode || !profile) return;
    await leaveStudyRoomParticipant(roomId, profile.uid);
  };

  const persistRoomStroke: CampusContextValue['persistRoomStroke'] = async (stroke) => {
    if (isDemoMode) return;
    await saveWhiteboardStroke(stroke);
  };

  const removeRoomStroke: CampusContextValue['removeRoomStroke'] = async (roomId, strokeId) => {
    if (isDemoMode) return;
    await deleteWhiteboardStroke(roomId, strokeId);
  };

  const clearRoomStrokesInFirestore: CampusContextValue['clearRoomStrokesInFirestore'] = async (roomId, isHostOrAdmin) => {
    if (isDemoMode || !profile) return;
    await clearRoomWhiteboardStrokes(roomId, isHostOrAdmin ? undefined : profile.uid);
  };

  const recordStudyContribution: CampusContextValue['recordStudyContribution'] = async (payload) => {
    if (!profile) return;
    const minDelta = Math.max(0, Math.min(240, Math.floor(payload.minutesDelta || 0)));
    const resDelta = Math.max(0, Math.min(5, Math.floor(payload.resourcesDelta || 0)));
    const sesDelta = Math.max(0, Math.min(3, Math.floor(payload.sessionsDelta || 0)));
    if (minDelta === 0 && resDelta === 0 && sesDelta === 0) return;

    if (isDemoMode) {
      setStudyContributors((prev) => {
        const existing = prev.find((c) => c.uid === profile.uid);
        if (existing) {
          const totalMinutes = existing.totalMinutes + minDelta;
          const resourcesSharedCount = existing.resourcesSharedCount + resDelta;
          const sessionsJoined = existing.sessionsJoined + sesDelta;
          const points = totalMinutes * 2 + resourcesSharedCount * 25 + sessionsJoined * 10;
          return prev.map((c) =>
            c.uid === profile.uid
              ? {
                  ...c,
                  displayName: profile.displayName,
                  primarySubjectId: payload.subjectId || c.primarySubjectId,
                  primarySubjectCode: payload.subjectCode || c.primarySubjectCode,
                  primarySubjectName: payload.subjectName || c.primarySubjectName,
                  totalMinutes,
                  resourcesSharedCount,
                  sessionsJoined,
                  points,
                }
              : c
          );
        }
        const points = minDelta * 2 + resDelta * 25 + sesDelta * 10;
        return [
          ...prev,
          {
            uid: profile.uid,
            displayName: profile.displayName,
            primarySubjectId: payload.subjectId,
            primarySubjectCode: payload.subjectCode,
            primarySubjectName: payload.subjectName,
            totalMinutes: minDelta,
            resourcesSharedCount: resDelta,
            sessionsJoined: sesDelta,
            points,
            isDemo: true,
          },
        ];
      });
      return;
    }

    await incrementStudyContributorStat({
      uid: profile.uid,
      displayName: profile.displayName,
      subjectId: payload.subjectId,
      subjectCode: payload.subjectCode,
      subjectName: payload.subjectName,
      minutesDelta: minDelta,
      resourcesDelta: resDelta,
      sessionsDelta: sesDelta,
    });
  };

  const persistRoomResource: CampusContextValue['persistRoomResource'] = async (resource) => {
    if (isDemoMode) return;
    await saveStudyRoomResource(resource);
  };

  const removeRoomResource: CampusContextValue['removeRoomResource'] = async (roomId, resourceId) => {
    if (isDemoMode) return;
    await deleteStudyRoomResource(roomId, resourceId);
  };

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const targetPct = profile?.targetAttendance || platformSettings.defaultRequiredAttendance || 75;

    attendanceRecords
      .filter((r) => !profile || r.studentUid === profile.uid)
      .forEach((rec) => {
        const analysis = analyzeAttendance(rec.classesAttended, rec.totalClasses, targetPct);
        if (!analysis.isMeetingTarget && rec.totalClasses > 0) {
          items.push({
            id: `notif_att_${rec.id}`,
            title: `Attendance Shortage: ${rec.subjectCode}`,
            detail: `${analysis.currentPercentage}% (${rec.classesAttended}/${rec.totalClasses}). Attend next ${analysis.classesNeeded} classes to reach ${targetPct}%.`,
            severity: analysis.statusLabel === 'Shortage' ? 'urgent' : 'warning',
            targetView: 'attendance',
          });
        }
      });

    exams.slice(0, 2).forEach((exam) => {
      items.push({
        id: `notif_exam_${exam.id}`,
        title: `Upcoming Exam: ${exam.subjectCode} (${exam.examType})`,
        detail: `${exam.examDate} · ${exam.startTime} · ${exam.venue}`,
        severity: 'info',
        targetView: 'exam-prep',
      });
    });

    announcements
      .filter((a) => a.isPinned)
      .slice(0, 2)
      .forEach((ann) => {
        items.push({
          id: `notif_ann_${ann.id}`,
          title: ann.title,
          detail: `${ann.authorName} · ${ann.category}`,
          severity: ann.category === 'urgent' ? 'urgent' : 'info',
          targetView: 'announcements',
        });
      });

    return items;
  }, [attendanceRecords, exams, announcements, profile, platformSettings.defaultRequiredAttendance]);

  const markAllNotificationsRead = () => {
    setReadNotificationIds(notifications.map((n) => n.id));
  };

  return (
    <CampusContext.Provider
      value={{
        firebaseUser,
        authReady,
        isDemoMode,
        isEmailUnverified,
        profile,
        activeRoleView,
        setActiveRoleView,
        enterDemoMode,
        exitDemoMode,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerification,
        refreshVerification,
        logout,
        activeView,
        setActiveView,
        theme,
        toggleTheme,
        colorPalette,
        setColorPalette,
        globalSearchQuery,
        setGlobalSearchQuery,
        aiPrefillMaterial,
        openAiWithMaterial,
        materialUploadRequested,
        openMaterialUploader,
        clearMaterialUploadRequest,
        departments,
        subjects,
        materials,
        bookmarks,
        attendanceRecords,
        attendanceLogs,
        exams,
        studyTasks,
        announcements,
        timetable,
        aiChats,
        platformSettings,
        allUsers,
        studentRoster,
        studyRooms,
        studyPresenceList,
        studyContributors,
        notifications,
        readNotificationIds,
        markAllNotificationsRead,
        seedSampleWorkspace,
        saveProfileChanges,
        toggleBookmarkMaterial,
        recordMaterialView,
        uploadAndCreateMaterial,
        removeMaterial,
        markAttendanceQuick,
        upsertAttendanceSubject,
        toggleStudyTask,
        createOrUpdateStudyTask,
        removeStudyTask,
        publishAnnouncement,
        removeAnnouncementItem,
        createExamSchedule,
        removeExamSchedule,
        createDepartmentItem,
        createSubjectItem,
        updatePlatformConfig,
        changeUserRole,
        persistAiChat,
        createStudyRoomItem,
        removeStudyRoomItem,
        publishMyStudyPresence,
        joinStudyRoomInFirestore,
        leaveStudyRoomInFirestore,
        persistRoomStroke,
        removeRoomStroke,
        clearRoomStrokesInFirestore,
        recordStudyContribution,
        persistRoomResource,
        removeRoomResource,
      }}
    >
      {children}
    </CampusContext.Provider>
  );
};

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used within CampusProvider');
  return ctx;
}

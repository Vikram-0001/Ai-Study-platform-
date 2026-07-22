"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, MessageSquare, UploadCloud, CheckCircle, AlertCircle,
  Trash2, Bookmark, History, BarChart2, Plus, Send, Users, Check,
  HelpCircle, FileText, Calendar, TrendingUp, LogOut, Lock, Unlock,
  Globe, RefreshCw, ChevronRight, Eye, ShieldAlert, Sparkles, BookMarked,
  Sun, Moon
} from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function Home() {
  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState<{ token: string; username: string; role: string } | null>(null);
  const [authMode, setAuthMode] = useState<"landing" | "login" | "signup">("landing");
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState("student");
  const [errorMsg, setErrorMsg] = useState("");

  // --- DASHBOARD STATE ---
  const [activeView, setActiveView] = useState<string>("chat");
  const [documents, setDocuments] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<string>("default_session");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [queryText, setQueryText] = useState("");

  // --- FILTER METADATA STATE ---
  const [filterDept, setFilterDept] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  // --- UPLOAD STATE ---
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVisibility, setUploadVisibility] = useState("private");
  const [uploadDept, setUploadDept] = useState("");
  const [uploadSem, setUploadSem] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadUnit, setUploadUnit] = useState("");
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  // --- STUDY GENERATORS STATE ---
  const [generatorTopic, setGeneratorTopic] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [studyToolTab, setStudyToolTab] = useState<"quiz" | "viva">("quiz");
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);
  const [quizResponses, setQuizResponses] = useState<Record<number, string>>({});
  const [showQuizExplanations, setShowQuizExplanations] = useState<Record<number, boolean>>({});
  const [vivaFlipped, setVivaFlipped] = useState<Record<number, boolean>>({});

  // --- SAVED ACADEMIC ITEMS ---
  const [savedQuizzes, setSavedQuizzes] = useState<any[]>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<any[]>([]);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);

  // --- ADMIN PORTAL STATE ---
  const [adminQueue, setAdminQueue] = useState<any[]>([]);
  const [adminAnalytics, setAdminAnalytics] = useState<any>(null);
  const [adminStudents, setAdminStudents] = useState<any[]>([]);

  // --- GLOBAL LOADING ---
  const [isProcessing, setIsProcessing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECT: INITIALIZE THEME PREFERENCE ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // --- EFFECT: LOAD AUTH STATE ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    if (token && username && role) {
      setUser({ token, username, role });
      // If user is admin, set view to queue dashboard, otherwise chat
      setActiveView(role === "admin" ? "admin_queue" : "chat");
    }
  }, []);

  // --- EFFECT: UPDATE CORRESPONDING DATA ON VIEW SWITCH ---
  useEffect(() => {
    if (!user) return;
    if (activeView === "documents" || activeView === "admin_docs") {
      fetchDocuments();
    } else if (activeView === "bookmarks") {
      fetchBookmarks();
    } else if (activeView === "history") {
      fetchSessions();
    } else if (activeView === "admin_queue") {
      fetchAdminQueue();
    } else if (activeView === "admin_analytics") {
      fetchAdminAnalytics();
    } else if (activeView === "admin_students") {
      fetchAdminStudents();
    } else if (activeView === "chat") {
      fetchSessions();
      loadActiveChatHistory();
    }
  }, [activeView, user, activeSession]);

  // Scroll Chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- ACTIONS: AUTHENTICATION ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsProcessing(true);
    try {
      if (supabase) {
        if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: emailInput,
            password: passwordInput,
            options: {
              data: {
                username: usernameInput,
                role: roleInput
              }
            }
          });
          if (error) throw error;

          const sessionToken = data.session?.access_token;
          if (sessionToken) {
            const syncRes = await api.auth.sync(sessionToken);
            localStorage.setItem("token", sessionToken);
            localStorage.setItem("username", syncRes.username);
            localStorage.setItem("role", syncRes.role);
            setUser({ token: sessionToken, username: syncRes.username, role: syncRes.role });
            setActiveView(syncRes.role === "admin" ? "admin_queue" : "chat");
          } else {
            alert("Sign up successful! Please check your email to confirm registration before logging in.");
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput || usernameInput,
            password: passwordInput
          });
          if (error) throw error;

          const sessionToken = data.session?.access_token;
          if (sessionToken) {
            const syncRes = await api.auth.sync(sessionToken);
            localStorage.setItem("token", sessionToken);
            localStorage.setItem("username", syncRes.username);
            localStorage.setItem("role", syncRes.role);
            setUser({ token: sessionToken, username: syncRes.username, role: syncRes.role });
            setActiveView(syncRes.role === "admin" ? "admin_queue" : "chat");
          }
        }
      } else {
        if (authMode === "signup") {
          const data = await api.auth.signup({
            username: usernameInput,
            email: emailInput,
            password: passwordInput,
            role: roleInput
          });
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("role", data.role);
          setUser({ token: data.access_token, username: data.username, role: data.role });
          setActiveView(data.role === "admin" ? "admin_queue" : "chat");
        } else {
          const data = await api.auth.login({
            username_or_email: emailInput || usernameInput,
            password: passwordInput
          });
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("role", data.role);
          setUser({ token: data.access_token, username: data.username, role: data.role });
          setActiveView(data.role === "admin" ? "admin_queue" : "chat");
        }
      }
      // Reset inputs
      setUsernameInput("");
      setEmailInput("");
      setPasswordInput("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed authentication request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error(err);
      }
    }
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setUser(null);
    setAuthMode("landing");
    setChatMessages([]);
  };

  // --- ACTIONS: DATA FETCHING ---
  const fetchDocuments = async () => {
    try {
      const data = await api.documents.list();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const data = await api.chat.listBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await api.chat.getSessions();
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadActiveChatHistory = async () => {
    if (!activeSession) return;
    try {
      const data = await api.chat.getHistory(activeSession);
      const formatted = data.map((msg: any) => ({
        role: msg.role,
        text: msg.content,
        decision: msg.decision,
        citations: msg.citations || []
      }));
      setChatMessages(formatted.length > 0 ? formatted : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminQueue = async () => {
    try {
      const data = await api.admin.getQueue();
      setAdminQueue(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminAnalytics = async () => {
    try {
      const data = await api.admin.getAnalytics();
      setAdminAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminStudents = async () => {
    try {
      const data = await api.admin.getStudents();
      setAdminStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  // --- ACTIONS: UPLOAD ---
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadProgress("Uploading and parsing document chunks...");
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("visibility", user?.role === "admin" ? "global" : uploadVisibility);
    if (uploadDept) formData.append("department", uploadDept);
    if (uploadSem) formData.append("semester", uploadSem);
    if (uploadSubject) formData.append("subject", uploadSubject);
    if (uploadUnit) formData.append("unit", uploadUnit);
    if (uploadTopic) formData.append("topic", uploadTopic);

    try {
      await api.documents.upload(formData);
      setUploadProgress("Document uploaded and indexed successfully!");
      setUploadFile(null);
      setUploadDept("");
      setUploadSem("");
      setUploadSubject("");
      setUploadUnit("");
      setUploadTopic("");
      fetchDocuments();
    } catch (err: any) {
      setUploadProgress(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.documents.delete(id);
      fetchDocuments();
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const handleOpenDocument = (docId: number) => {
    const token = localStorage.getItem("token") || "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${baseUrl}/documents/${docId}/download?token=${encodeURIComponent(token)}`;
    window.open(url, "_blank");
  };

  // --- ACTIONS: CHAT QUERY ---
  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    const userMessage = {
      role: "user",
      text: queryText,
      decision: "input",
      citations: []
    };

    setChatMessages((prev) => [...prev, userMessage]);
    const originalQuery = queryText;
    setQueryText("");
    setIsProcessing(true);

    try {
      const searchFilters: any = {};
      if (filterDept) searchFilters.department = filterDept;
      if (filterSem) searchFilters.semester = parseInt(filterSem);
      if (filterSubject) searchFilters.subject = filterSubject;
      if (filterUnit) searchFilters.unit = filterUnit;
      if (filterTopic) searchFilters.topic = filterTopic;

      const response = await api.chat.query({
        query: originalQuery,
        session_id: activeSession,
        ...searchFilters
      });

      const assistantMessage = {
        role: "assistant",
        text: response.answer,
        decision: response.decision,
        citations: response.citations || [],
        grounding_score: response.grounding_score
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error processing query: ${err.message}`,
          decision: "error",
          citations: []
        }
      ]);
    } finally {
      setIsProcessing(false);
      fetchSessions();
    }
  };

  const createNewChatSession = () => {
    const newSessionId = `session_${Date.now()}`;
    setActiveSession(newSessionId);
    setChatMessages([]);
  };

  const handleBookmarkAnswer = async (msg: any) => {
    try {
      await api.chat.saveBookmark({
        query: "Academic Query Session",
        answer: msg.text,
        citations: msg.citations
      });
      alert("Answer bookmarked successfully!");
    } catch (err: any) {
      alert(`Error bookmarking: ${err.message}`);
    }
  };

  const handleDeleteBookmark = async (id: number) => {
    try {
      await api.chat.deleteBookmark(id);
      fetchBookmarks();
    } catch (err) {
      alert("Failed to delete bookmark");
    }
  };

  // --- ACTIONS: ADMIN QUEUE ---
  const handleApproveReject = async (docId: number, action: "approve" | "reject") => {
    try {
      await api.admin.approveDocument(docId, action);
      alert(`Document successfully ${action === "approve" ? "Approved" : "Rejected"}`);
      fetchAdminQueue();
    } catch (err: any) {
      alert(`Queue Error: ${err.message}`);
    }
  };

  const handleDeleteStudent = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to permanently delete the student account "${username}"? This will delete all of their uploaded documents, chat history, quizzes, and other personal data from the database.`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await api.admin.deleteStudent(userId);
      alert(`Student account "${username}" has been successfully deleted.`);
      fetchAdminStudents();
    } catch (err: any) {
      alert(`Error deleting student: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ACTIONS: STUDY TOOL GENERATION ---
  const handleGenerateStudyTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatorTopic.trim()) return;
    setIsProcessing(true);
    setGeneratedOutput(null);
    setQuizResponses({});
    setShowQuizExplanations({});
    setVivaFlipped({});

    const reqPayload = {
      topic: generatorTopic,
      document_id: selectedDocId ? parseInt(selectedDocId) : undefined
    };

    try {
      if (studyToolTab === "quiz") {
        const data = await api.study.generateQuiz(reqPayload);
        setGeneratedOutput(data);
      } else if (studyToolTab === "viva") {
        const data = await api.study.generateViva(reqPayload);
        setGeneratedOutput(data);
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveGeneratedAsset = async () => {
    if (!generatedOutput) return;
    try {
      if (studyToolTab === "quiz") {
        await api.study.saveQuiz(generatedOutput);
      }
      alert("Academic asset saved to dashboard successfully!");
    } catch (err: any) {
      alert(`Failed saving item: ${err.message}`);
    }
  };

  const checkAnswerQuiz = (questionIdx: number, selected: string) => {
    setQuizResponses((prev) => ({ ...prev, [questionIdx]: selected }));
    setShowQuizExplanations((prev) => ({ ...prev, [questionIdx]: true }));
  };

  const toggleVivaReveal = (idx: number) => {
    setVivaFlipped((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // --- VIEW RENDERING ENGINE ---

  // 1. Landing View
  if (authMode === "landing" && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-[var(--bg-main)] relative overflow-hidden">
        {/* Hero Background Zoom & Floating Particles (Visual Only) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--accent-gold)] rounded-full blur-[140px] opacity-20 pointer-events-none animate-glow hero-zoom"></div>
        <div className="absolute top-1/6 left-1/4 w-12 h-12 rounded-full bg-[var(--accent-gold)] blur-md opacity-25 pointer-events-none floating-particle-1"></div>
        <div className="absolute bottom-1/4 right-1/4 w-16 h-16 rounded-full bg-[var(--accent-maroon)] blur-md opacity-25 pointer-events-none floating-particle-2"></div>
        <div className="absolute top-1/3 right-1/3 w-8 h-8 rounded-full bg-[var(--accent-gold)] blur-sm opacity-30 pointer-events-none floating-particle-3"></div>

        <div className="relative z-10 max-w-4xl space-y-8 academic-card-glow p-10 md:p-16 border border-[var(--border-accent)] hero-text-fade">
          {/* Theme Toggle Button */}
          <div className="absolute top-6 right-6">
            <button
              type="button"
              onClick={() => {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const next = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
              }}
              className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] transition-all cursor-pointer shadow-sm hover-scale"
              title="Toggle Theme"
            >
              <Sun className="w-4.5 h-4.5 theme-sun-icon text-[var(--accent-gold)]" />
              <Moon className="w-4.5 h-4.5 theme-moon-icon text-[var(--accent-maroon)]" />
            </button>
          </div>

          {/* Centered Vector Illustration */}
          <div className="flex justify-center my-2 hover-scale">
            <img
              src="/study-illustration.svg"
              alt="Academic Study Assistant Illustration"
              className="w-56 sm:w-64 md:w-80 h-auto object-contain filter drop-shadow-md"
            />
          </div>

          <h1 className="text-4xl md:text-6xl font-serif-heading font-bold tracking-tight leading-tight text-[var(--text-heading)]">
            Academic <br />
            <span className="text-[var(--accent-gold)] italic font-academic-subheading">
              Study Platform & Assistant
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-[var(--text-secondary)] text-base md:text-lg leading-relaxed font-academic-subheading">
            Upload syllabi, notes, textbooks, and presentations. Our intelligent Decision Engine prioritizes vector datastores to answer factual queries instantly, engaging reasoning assistance when required.
          </p>

          {/* Highlights grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] hover-lift">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[var(--text-heading)] mb-1">RAG-First Execution</h3>
              <p className="text-[var(--text-secondary)] text-sm font-academic-subheading">Direct factual definition requests execute zero LLM calls, saving API resources.</p>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] hover-lift">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[var(--text-heading)] mb-1">Semantic Hierarchies</h3>
              <p className="text-[var(--text-secondary)] text-sm font-academic-subheading">Organize vectors by Department, Semester, Subject, Unit, and Topic tags.</p>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] hover-lift">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-serif-heading text-lg font-bold text-[var(--text-heading)] mb-1">Self-RAG Reflection</h3>
              <p className="text-[var(--text-secondary)] text-sm font-academic-subheading">Verifies grounding claims, fallback query triggers web search verification.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setAuthMode("login")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[var(--accent-maroon)] text-white font-bold hover:bg-[var(--accent-maroon-hover)] border border-[var(--border-accent)] font-serif-heading transition-all shadow-md cursor-pointer hover-scale"
            >
              Get Started Dashboard
            </button>
            <a
              href="#learn-more"
              onClick={() => alert("Enterprise RAG study platform designed for university students. Admins publish syllabus, students upload notes (private/community).")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold font-academic-subheading hover:border-[var(--accent-gold)] transition-all cursor-pointer hover-scale"
            >
              Core Architecture
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authentication View
  if ((authMode === "login" || authMode === "signup") && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-[var(--bg-main)]">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-[var(--accent-gold)] rounded-full blur-[140px] opacity-15 pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-md academic-card p-8 rounded-3xl space-y-6 border border-[var(--border-color)]">
          {/* Centered Study Illustration & Platform Title */}
          <div className="flex flex-col items-center text-center pb-2 border-b border-[var(--border-color)]">
            <img
              src="/study-illustration.svg"
              alt="Academic Study Assistant Illustration"
              className="w-48 h-auto object-contain mb-3 drop-shadow-md hover-scale"
            />
            <h1 className="text-sm uppercase tracking-wider font-serif-heading font-bold text-[var(--accent-gold)]">
              Academic Study Platform & Assistant
            </h1>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-left">
              <h2 className="text-2xl font-serif-heading font-bold text-[var(--text-heading)]">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-[var(--accent-gold)] text-sm font-academic-subheading mt-1">
                {authMode === "login" ? "Sign in to access your academic study portal" : "Register a student profile"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const next = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
              }}
              className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] transition-all cursor-pointer"
              title="Toggle Theme"
            >
              <Sun className="w-4 h-4 theme-sun-icon text-[var(--accent-gold)]" />
              <Moon className="w-4 h-4 theme-moon-icon text-[var(--accent-maroon)]" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl flex items-center space-x-2 font-academic-subheading">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Username</label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-2.5 academic-input text-sm"
                  placeholder="john_doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Email Address / Username</label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-2.5 academic-input text-sm"
                placeholder={authMode === "signup" ? "name@university.edu" : "name@university.edu or username"}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Secret Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 academic-input text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-[var(--accent-maroon)] hover:bg-[var(--accent-maroon-hover)] text-white font-serif-heading font-bold border border-[var(--border-accent)] transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{authMode === "login" ? "Login Session" : "Create Profile"}</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setErrorMsg("");
                setAuthMode(authMode === "login" ? "signup" : "login");
              }}
              className="text-xs text-[var(--accent-gold)] hover:underline font-academic-subheading"
            >
              {authMode === "login" ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Authenticated Dashboard Interface
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-main)]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Dashboard Title Header */}
          <div className="p-6 border-b border-white/10 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-maroon)] border border-[var(--border-accent)] flex items-center justify-center shadow-md">
              <BookOpen className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
            </div>
            <div>
              <span className="font-serif-heading font-bold text-lg tracking-wide text-[var(--accent-gold)]">
                STUDY ASSIST
              </span>
              <div className="text-[10px] text-[var(--text-sidebar-muted)] font-semibold uppercase tracking-wider font-academic-subheading">{user?.role} Portal</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {user?.role === "student" && (
              <>
                <button
                  onClick={() => setActiveView("chat")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "chat" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>AI Chat RAG</span>
                </button>

                <button
                  onClick={() => setActiveView("documents")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "documents" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <UploadCloud className="w-4.5 h-4.5" />
                  <span>Personal Library</span>
                </button>

                <button
                  onClick={() => setActiveView("study_generators")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "study_generators" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <Sparkles className="w-4.5 h-4.5" />
                  <span>AI Study Tools</span>
                </button>

                <button
                  onClick={() => setActiveView("bookmarks")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "bookmarks" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <Bookmark className="w-4.5 h-4.5" />
                  <span>Bookmarks</span>
                </button>

                <button
                  onClick={() => setActiveView("history")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "history" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <History className="w-4.5 h-4.5" />
                  <span>Query History</span>
                </button>
              </>
            )}

            {user?.role === "admin" && (
              <>
                <button
                  onClick={() => setActiveView("admin_queue")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "admin_queue" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <Eye className="w-4.5 h-4.5" />
                  <span>Approval Queue</span>
                </button>

                <button
                  onClick={() => setActiveView("admin_docs")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "admin_docs" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <UploadCloud className="w-4.5 h-4.5" />
                  <span>Official Library</span>
                </button>

                <button
                  onClick={() => setActiveView("chat")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "chat" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>RAG Testing Sandbox</span>
                </button>

                <button
                  onClick={() => setActiveView("admin_analytics")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "admin_analytics" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <BarChart2 className="w-4.5 h-4.5" />
                  <span>System Analytics</span>
                </button>

                <button
                  onClick={() => setActiveView("admin_students")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-academic-subheading font-medium transition-all cursor-pointer ${activeView === "admin_students" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border-l-4 border-[var(--accent-gold)] font-bold shadow-xs" : "text-slate-300 hover:text-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]"}`}
                >
                  <Users className="w-4.5 h-4.5" />
                  <span>Student Accounts</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* LOGOUT AREA & THEME TOGGLE */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-serif-heading font-bold text-white max-w-[130px] truncate">{user?.username}</div>
              <div className="text-[10px] text-[var(--accent-gold)] capitalize font-academic-subheading">{user?.role}</div>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs text-red-300 bg-red-950/40 hover:bg-red-900/50 font-bold transition-all border border-red-800/40 cursor-pointer font-academic-subheading"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const next = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
              }}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:border-[var(--accent-gold)] transition-all cursor-pointer shrink-0"
              title="Toggle Light / Dark Mode"
            >
              <Sun className="w-4 h-4 theme-sun-icon text-[var(--accent-gold)]" />
              <Moon className="w-4 h-4 theme-moon-icon text-[var(--accent-gold)]" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative p-6 bg-[var(--bg-main)]">
        {/* Ambient Background Glow matching Login Page */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--accent-gold)] rounded-full blur-[160px] opacity-10 pointer-events-none animate-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[var(--accent-maroon)] rounded-full blur-[160px] opacity-10 pointer-events-none"></div>

        {/* HEADER BAR */}
        <header className="flex items-center justify-between pb-6 border-b border-[var(--border-color)] mb-6 shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif-heading font-bold uppercase tracking-tight text-[var(--text-heading)]">
              {activeView.replace("_", " ")}
            </h1>
            <p className="text-sm text-[var(--accent-gold)] font-academic-subheading italic font-semibold mt-0.5">Academic Study Assistant — Enterprise RAG Platform</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="px-3.5 py-1.5 rounded-xl border border-[var(--border-accent)] bg-[var(--bg-surface-subtle)] flex items-center space-x-2 text-xs text-[var(--text-secondary)] font-academic-subheading font-semibold shadow-sm">
              <Globe className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>Datastore: SQLite + Qdrant</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const next = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
              }}
              className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-gold)] transition-all cursor-pointer shadow-sm"
              title="Toggle Theme"
            >
              <Sun className="w-4.5 h-4.5 theme-sun-icon text-[var(--accent-gold)]" />
              <Moon className="w-4.5 h-4.5 theme-moon-icon text-[var(--accent-maroon)]" />
            </button>

            {isProcessing && (
              <div className="flex items-center space-x-2 text-xs text-[var(--accent-gold)] font-academic-subheading font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </header>

        {/* INNER DYNAMIC VIEWS SWITCH WITH FADE+SLIDE TRANSITION */}

        {/* VIEW 1: AI CHAT RAG */}
        {activeView === "chat" && (
          <div key="view-chat" className="view-transition flex flex-col h-[calc(100vh-140px)] min-h-0 academic-card overflow-hidden border border-[var(--border-color)]">
            {/* Top Filter and Info Bar */}
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs font-academic-subheading">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="px-3 py-1.5 academic-input text-xs font-academic-subheading font-medium text-[var(--text-primary)]"
                >
                  <option value="">Department (All)</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="ME">ME</option>
                </select>
                <input
                  type="number"
                  value={filterSem}
                  onChange={(e) => setFilterSem(e.target.value)}
                  placeholder="Sem"
                  className="w-16 px-3 py-1.5 academic-input text-xs font-academic-subheading text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  placeholder="Subject (e.g. DBMS)"
                  className="px-3 py-1.5 academic-input text-xs font-academic-subheading text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-16 px-3 py-1.5 academic-input text-xs font-academic-subheading text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={activeSession}
                  onChange={(e) => setActiveSession(e.target.value)}
                  className="px-3 py-1.5 academic-input text-xs font-academic-subheading text-[var(--text-primary)]"
                >
                  <option value="default_session">Default Session</option>
                  {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={createNewChatSession}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-maroon)] hover:bg-[var(--accent-maroon-hover)] font-serif-heading font-bold text-white flex items-center space-x-1 border border-[var(--border-accent)] transition-all cursor-pointer shadow-sm text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--border-accent)] flex items-center justify-center shadow-md">
                    <MessageSquare className="w-8 h-8 text-[var(--accent-gold)]" />
                  </div>
                  <div>
                    <h3 className="font-serif-heading text-2xl font-bold text-[var(--text-heading)]">Ask an Academic Question</h3>
                    <p className="text-sm max-w-sm mt-1.5 font-academic-subheading text-[var(--accent-gold)] italic">E.g., "What is Normalization?", "Explain quick sort", or search specific subject chapters.</p>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-sm shadow-sm ${msg.role === "user" ? "bg-[var(--accent-maroon)] text-white rounded-tr-none border border-[var(--border-accent)] font-academic-subheading" : "bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-none font-academic-subheading"}`}>

                    {/* Badge showing LLM Decision Engine path */}
                    {msg.role === "assistant" && (
                      <div className="flex items-center space-x-2 mb-2 pb-1 border-b border-[var(--border-color)]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-academic-subheading ${msg.decision === "retrieval_only" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20" : "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border border-[var(--border-accent)]"}`}>
                          {msg.decision === "retrieval_only" ? "RAG-Only Direct Output" : "LLM Reasoning Assistance"}
                        </span>
                        {msg.grounding_score !== undefined && (
                          <span className="text-[10px] text-[var(--accent-gold)] font-academic-subheading">
                            Grounding: {(msg.grounding_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}

                    <div className={`prose max-w-none whitespace-pre-wrap leading-relaxed font-academic-subheading text-sm ${msg.role === "user" ? "text-white prose-invert" : "text-[var(--text-primary)] prose-stone"}`}>
                      {msg.text}
                    </div>

                    {/* Citations List */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--accent-gold)] font-bold mb-1.5 flex items-center space-x-1 font-serif-heading">
                          <BookOpen className="w-3 h-3" />
                          <span>Retrieved Citations & Context Sources</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {msg.citations.map((cit: any, cIdx: number) => (
                            <div key={cIdx} className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] flex flex-col shadow-xs font-academic-subheading">
                              <span className="font-semibold text-[var(--text-primary)] truncate">[{cit.source_index}] {cit.document_name}</span>
                              <span className="text-[var(--accent-gold)] text-[10px] mt-0.5">
                                Page: {cit.page} • Visibility: {cit.visibility} {cit.subject ? `• ${cit.subject}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Action Controls */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center space-x-3 mt-1.5 px-2">
                      <button
                        onClick={() => handleBookmarkAnswer(msg)}
                        className="text-[10px] font-semibold text-[var(--accent-gold)] hover:underline flex items-center space-x-1 cursor-pointer transition-colors font-academic-subheading"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>Bookmark Answer</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Field */}
            <form onSubmit={handleSendQuery} className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface-subtle)] flex items-center space-x-2 font-academic-subheading">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Ask your Academic Study Assistant..."
                className="flex-1 px-4 py-3 academic-input text-sm font-academic-subheading placeholder:font-academic-subheading placeholder:text-[var(--text-muted)]"
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="p-3 rounded-xl bg-[var(--accent-maroon)] hover:bg-[var(--accent-maroon-hover)] text-[var(--accent-gold)] font-bold border border-[var(--border-accent)] disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: PERSONAL/OFFICIAL DOCUMENT LIBRARY */}
        {(activeView === "documents" || activeView === "admin_docs") && (
          <div key={`view-${activeView}`} className="view-transition space-y-6 font-academic-subheading">

            {/* Upload Portal Widget */}
            <div className="academic-card p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent-gold)] mb-4 flex items-center space-x-2 font-serif-heading">
                <UploadCloud className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
                <span>Upload New Academic Document</span>
              </h2>

              <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Select Academic File (PDF, PPTX, DOCX, TXT)</label>
                  <div className="border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent-gold)] rounded-xl p-5 flex flex-col items-center justify-center bg-[var(--bg-surface-subtle)] transition-all cursor-pointer relative">
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                    <UploadCloud className="w-8 h-8 text-[var(--accent-gold)] mb-2" />
                    <span className="text-xs text-[var(--text-primary)] font-medium font-academic-subheading">
                      {uploadFile ? uploadFile.name : "Drag & drop files or click to browse files"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Visibility Mode</label>
                  <select
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value)}
                    disabled={user?.role === "admin"}
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  >
                    {user?.role === "admin" ? (
                      <option value="global">Global (Official Library)</option>
                    ) : (
                      <>
                        <option value="private">Private (Only Me)</option>
                        <option value="community">Community (Awaiting Admin Approval)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Department Target</label>
                  <input
                    type="text"
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    placeholder="E.g. CSE"
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Semester</label>
                  <input
                    type="number"
                    value={uploadSem}
                    onChange={(e) => setUploadSem(e.target.value)}
                    placeholder="E.g. 4"
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Subject Tag</label>
                  <input
                    type="text"
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    placeholder="E.g. Operating Systems"
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Unit</label>
                  <input
                    type="text"
                    value={uploadUnit}
                    onChange={(e) => setUploadUnit(e.target.value)}
                    placeholder="E.g. Unit 3"
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Topic Target</label>
                  <input
                    type="text"
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                    placeholder="E.g. Process Scheduling"
                    className="w-full px-3 py-2 academic-input text-xs font-academic-subheading"
                  />
                </div>

                <div className="md:col-span-3 flex items-center justify-between pt-2">
                  <div className="text-xs text-[var(--accent-gold)] font-semibold font-academic-subheading">{uploadProgress}</div>
                  <button
                    type="submit"
                    disabled={isProcessing || !uploadFile}
                    className="px-6 py-2.5 rounded-xl bg-[var(--accent-maroon)] hover:bg-[var(--accent-maroon-hover)] font-serif-heading font-bold text-white border border-[var(--border-accent)] disabled:opacity-50 transition-all cursor-pointer shadow-sm text-xs"
                  >
                    Upload and Index File
                  </button>
                </div>
              </form>
            </div>

            {/* Document Library Table */}
            <div className="academic-card p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent-gold)] mb-4 flex items-center space-x-2 font-serif-heading">
                <BookOpen className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
                <span>Document Library Assets</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-academic-subheading">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">
                      <th className="py-3 px-4">Document Name</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4">Uploaded By</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Semester</th>
                      <th className="py-3 px-4">Pages</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                          No indexed documents in target library.
                        </td>
                      </tr>
                    )}
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[var(--bg-surface-subtle)] transition-all text-[var(--text-secondary)]">
                        <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.name}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${doc.visibility === "global" ? "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20" :
                              doc.visibility === "community" ? "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border border-[var(--border-accent)]" : "bg-stone-500/10 text-stone-600 border border-stone-500/20"
                            }`}>
                            {doc.visibility}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[var(--text-primary)]">{doc.uploader_username || "System"}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${doc.uploader_role === "admin" ? "text-[var(--accent-gold)]" : "text-slate-400"
                              }`}>
                              {doc.uploader_role || "admin"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[var(--text-secondary)]">{doc.subject || "—"}</td>
                        <td className="py-3.5 px-4">{doc.semester || "—"}</td>
                        <td className="py-3.5 px-4">{doc.page_count}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${doc.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                              doc.status === "pending_approval" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"
                            }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenDocument(doc.id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border border-[var(--border-accent)] hover:bg-[var(--accent-gold)] hover:text-white transition-all cursor-pointer shadow-xs font-serif-heading"
                            title="Open Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="font-bold text-xs">Open</span>
                          </button>
                          {user?.role === "admin" && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 transition-all cursor-pointer"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: AI STUDY TOOLS */}
        {activeView === "study_generators" && (
          <div key="view-study_generators" className="view-transition space-y-6 font-academic-subheading">

            {/* Control Panel Widget */}
            <div className="academic-card p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent-gold)] mb-4 flex items-center space-x-2 font-serif-heading">
                <Sparkles className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
                <span>AI Study Assets Builder</span>
              </h2>

              <form onSubmit={handleGenerateStudyTool} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Target Topic or Concept</label>
                  <input
                    type="text"
                    value={generatorTopic}
                    onChange={(e) => setGeneratorTopic(e.target.value)}
                    placeholder="E.g., Binary Search Algorithm, Deadlock conditions..."
                    className="w-full px-4 py-2.5 academic-input text-sm font-academic-subheading"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 font-academic-subheading">Optional File Scope</label>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full px-3 py-2.5 academic-input text-xs font-academic-subheading"
                  >
                    <option value="">All Database Materials</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isProcessing || !generatorTopic}
                    className="w-full py-3 rounded-xl bg-[var(--accent-maroon)] hover:bg-[var(--accent-maroon-hover)] text-white font-serif-heading font-bold border border-[var(--border-accent)] disabled:opacity-50 transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                  >
                    {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Generate Academic Assets</span>
                  </button>
                </div>
              </form>

              {/* Study Tool Tabs Selection */}
              <div className="flex border-b border-[var(--border-color)] mt-6 gap-6 text-xs font-bold text-[var(--text-muted)] font-serif-heading">
                <button
                  onClick={() => setStudyToolTab("quiz")}
                  className={`pb-2.5 transition-all cursor-pointer ${studyToolTab === "quiz" ? "text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]" : "hover:text-[var(--text-primary)]"}`}
                >
                  Interactive Quiz
                </button>
                <button
                  onClick={() => setStudyToolTab("viva")}
                  className={`pb-2.5 transition-all cursor-pointer ${studyToolTab === "viva" ? "text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]" : "hover:text-[var(--text-primary)]"}`}
                >
                  Viva Q&A Cards
                </button>
              </div>
            </div>

            {/* Generated Output Area */}
            {generatedOutput && (
              <div className="academic-card p-6 rounded-2xl space-y-6">

                {/* Save Header Action */}
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                  <h3 className="font-serif-heading font-bold text-base text-[var(--text-heading)]">
                    Generated {studyToolTab} deck
                  </h3>
                  {studyToolTab === "quiz" && (
                    <button
                      onClick={saveGeneratedAsset}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-accent)] text-[var(--accent-gold)] font-serif-heading font-bold hover:bg-[var(--accent-gold)] hover:text-white text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save asset to Library</span>
                    </button>
                  )}
                </div>

                {/* Sub Tab Output: 1. QUIZ */}
                {studyToolTab === "quiz" && (
                  <div key="tab-quiz" className="animate-zoom-scroll space-y-6">
                    <h4 className="font-serif-heading text-lg font-bold text-[var(--text-primary)]">{generatedOutput.title}</h4>
                    <div className="space-y-4">
                      {generatedOutput.questions?.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] space-y-3 font-academic-subheading">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-[var(--accent-gold)] font-serif-heading">Question {qIdx + 1} ({q.type})</span>
                            {showQuizExplanations[qIdx] && (
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${quizResponses[qIdx] === q.answer ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20" : "bg-red-500/15 text-red-600 border border-red-500/20"
                                }`}>
                                {quizResponses[qIdx] === q.answer ? "Correct Answer" : "Incorrect Answer"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{q.question}</p>

                          {/* Multiple Choice Render */}
                          {q.type === "mcq" && q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              {q.options.map((opt: string) => (
                                <button
                                  key={opt}
                                  onClick={() => checkAnswerQuiz(qIdx, opt)}
                                  className={`px-4 py-2.5 rounded-xl border text-xs text-left font-semibold transition-all cursor-pointer font-academic-subheading ${quizResponses[qIdx] === opt ? "bg-[var(--accent-maroon)] border-[var(--border-accent)] text-white" : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)]"
                                    }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* True / False Render */}
                          {q.type === "true_false" && q.options && (
                            <div className="flex gap-4 pt-2">
                              {q.options.map((opt: string) => (
                                <button
                                  key={opt}
                                  onClick={() => checkAnswerQuiz(qIdx, opt)}
                                  className={`px-6 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer font-academic-subheading ${quizResponses[qIdx] === opt ? "bg-[var(--accent-maroon)] border-[var(--border-accent)] text-white" : "bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-gold)]"
                                    }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Coding / Short Answer Render */}
                          {["coding", "fill_in_blanks"].includes(q.type) && (
                            <div className="space-y-2 pt-2">
                              <input
                                type="text"
                                placeholder="Type your answer code/text..."
                                onBlur={(e) => checkAnswerQuiz(qIdx, e.target.value)}
                                className="w-full px-4 py-2.5 academic-input text-xs font-mono"
                              />
                              <div className="text-[10px] text-[var(--text-muted)] font-academic-subheading">Press tab or click out to lock answer.</div>
                            </div>
                          )}

                          {/* Explanation Output */}
                          {showQuizExplanations[qIdx] && (
                            <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] text-xs space-y-1.5 mt-2 font-academic-subheading">
                              <div><span className="font-bold text-emerald-600">Correct Answer:</span> <code className="font-mono bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">{q.answer}</code></div>
                              <p className="text-[var(--text-secondary)] leading-relaxed"><span className="font-bold text-[var(--text-primary)]">Explanation:</span> {q.explanation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub Tab Output: 2. VIVA CARDS */}
                {studyToolTab === "viva" && (
                  <div key="tab-viva" className="animate-zoom-scroll grid grid-cols-1 md:grid-cols-2 gap-4 font-academic-subheading">
                    {generatedOutput.questions?.map((q: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => toggleVivaReveal(idx)}
                        className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] cursor-pointer min-h-[140px] flex flex-col justify-between hover:border-[var(--accent-gold)] transition-all select-none shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold text-[var(--accent-gold)] font-serif-heading">{q.level} Viva Q</span>
                            <span className="text-[9px] text-[var(--accent-gold)] font-academic-subheading italic">Click card to Flip</span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{q.question}</p>
                        </div>
                        {vivaFlipped[idx] && (
                          <div className="mt-4 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] p-3 rounded-xl leading-relaxed">
                            <span className="font-bold text-emerald-600 block mb-1">Examiner Reference Answer:</span>
                            {q.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}


              </div>
            )}
          </div>
        )}

        {/* VIEW 4: BOOKMARKS */}
        {activeView === "bookmarks" && (
          <div key="view-bookmarks" className="view-transition grid grid-cols-1 gap-4 font-academic-subheading">
            {bookmarks.length === 0 && (
              <div className="text-center p-12 text-[var(--text-muted)]">
                No bookmarked answers saved.
              </div>
            )}
            {bookmarks.map((bm) => (
              <div key={bm.id} className="academic-card p-6 rounded-2xl relative">
                <button
                  onClick={() => handleDeleteBookmark(bm.id)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <h3 className="font-serif-heading font-bold text-[var(--accent-gold)] text-xs uppercase tracking-wider mb-2">Bookmarked Study Material</h3>
                <p className="text-sm font-semibold text-[var(--text-secondary)] mb-2 font-academic-subheading">Query Context Session</p>
                <div className="prose prose-stone max-w-none text-[var(--text-primary)] text-xs whitespace-pre-wrap leading-relaxed font-academic-subheading">
                  {bm.answer}
                </div>

                {bm.citations && bm.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex flex-wrap gap-2">
                    {bm.citations.map((c: any, cIdx: number) => (
                      <span key={cIdx} className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] text-[10px] text-[var(--accent-gold)] font-academic-subheading">
                        Source {c.source_index}: {c.document_name} (Page {c.page})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VIEW 5: HISTORY */}
        {activeView === "history" && (
          <div key="view-history" className="view-transition space-y-4 font-academic-subheading">
            {sessions.length === 0 && (
              <div className="text-center p-12 text-[var(--text-muted)]">
                No previous conversations exist.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sessions.map((sess) => (
                <div
                  key={sess}
                  onClick={() => {
                    setActiveSession(sess);
                    setActiveView("chat");
                  }}
                  className="academic-card p-5 rounded-2xl cursor-pointer hover:border-[var(--accent-gold)] transition-all flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] flex items-center justify-center shrink-0 border border-[var(--border-accent)]">
                      <MessageSquare className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-serif-heading font-semibold text-sm text-[var(--text-primary)] truncate block">{sess}</span>
                      <span className="text-[10px] text-[var(--accent-gold)] block font-academic-subheading italic">Click to reload transcript</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--accent-gold)]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6: ADMIN APPROVAL QUEUE */}
        {activeView === "admin_queue" && (
          <div key="view-admin_queue" className="view-transition academic-card p-6 rounded-2xl font-academic-subheading">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent-gold)] mb-4 flex items-center space-x-2 font-serif-heading">
              <Eye className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
              <span>Pending Student Community Uploads</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-academic-subheading">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Subject Target</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {adminQueue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--text-muted)] font-academic-subheading">
                        All student submissions processed. Queue is currently empty.
                      </td>
                    </tr>
                  )}
                  {adminQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-surface-subtle)] transition-all text-[var(--text-secondary)]">
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)] flex items-center space-x-2 font-academic-subheading">
                        <FileText className="w-4 h-4 text-[var(--accent-gold)]" />
                        <span>{item.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-primary)]">{item.uploader_username || "System"}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${item.uploader_role === "admin" ? "text-[var(--accent-gold)]" : "text-slate-400"
                            }`}>
                            {item.uploader_role || "student"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-secondary)]">{item.subject || "—"}</td>
                      <td className="py-3.5 px-4">{item.semester || "—"}</td>
                      <td className="py-3.5 px-4">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenDocument(item.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] border border-[var(--border-accent)] hover:bg-[var(--accent-gold)] hover:text-white transition-all cursor-pointer shadow-xs font-serif-heading text-[11px] font-bold"
                          title="Open Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </button>
                        <button
                          onClick={() => handleApproveReject(item.id, "approve")}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-serif-heading font-bold hover:bg-emerald-500/20 transition-all text-[11px] cursor-pointer"
                        >
                          Approve Upload
                        </button>
                        <button
                          onClick={() => handleApproveReject(item.id, "reject")}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-serif-heading font-bold hover:bg-red-500/20 transition-all text-[11px] cursor-pointer"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 7: ADMIN ANALYTICS */}
        {activeView === "admin_analytics" && adminAnalytics && (
          <div key="view-admin_analytics" className="view-transition space-y-6 font-academic-subheading">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="academic-card p-6 rounded-2xl">
                <span className="text-[10px] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">Total Registered Users</span>
                <div className="text-3xl font-serif-heading font-black text-[var(--text-heading)] mt-1">{adminAnalytics.users?.total}</div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-academic-subheading">Students: {adminAnalytics.users?.students} • Admins: {adminAnalytics.users?.admins}</div>
              </div>

              <div className="academic-card p-6 rounded-2xl">
                <span className="text-[10px] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">Official Library Documents</span>
                <div className="text-3xl font-serif-heading font-black text-[var(--accent-gold)] mt-1">{adminAnalytics.documents?.official}</div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-academic-subheading">Global Knowledge Sources</div>
              </div>

              <div className="academic-card p-6 rounded-2xl">
                <span className="text-[10px] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">Community Notes (Approved)</span>
                <div className="text-3xl font-serif-heading font-black text-[var(--accent-gold)] mt-1">{adminAnalytics.documents?.community_approved}</div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-academic-subheading">Awaiting verification queue: {adminAnalytics.documents?.pending_approval}</div>
              </div>

              <div className="academic-card p-6 rounded-2xl">
                <span className="text-[10px] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">Qdrant Indexed Vector Chunks</span>
                <div className="text-3xl font-serif-heading font-black text-[var(--text-heading)] mt-1">{adminAnalytics.vector_chunks}</div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-academic-subheading">Dimension size: 1536</div>
              </div>
            </div>

            {/* General Description Card */}
            <div className="academic-card p-6 rounded-2xl">
              <h3 className="font-serif-heading font-bold text-[var(--text-heading)] text-sm mb-3">SYSTEM INFRASTRUCTURE REVIEW</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 font-academic-subheading">
                This platform is running an intelligent Decision Engine that filters intent to optimize cost and latency. Factual matching uses vector and keyword searches under reciprocal rank fusion (RRF) with metadata validation before deciding to execute LLM API queries.
              </p>
              <div className="flex gap-2 flex-wrap font-academic-subheading">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] text-[10px] text-[var(--accent-gold)] font-bold">QDRANT MEMORY MODE</span>
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] text-[10px] text-[var(--accent-gold)] font-bold">SECURITY PIPELINE ON</span>
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-color)] text-[10px] text-[var(--accent-gold)] font-bold">API CACHING ACTIVE</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 8: ADMIN STUDENTS LIST */}
        {activeView === "admin_students" && (
          <div key="view-admin_students" className="view-transition academic-card p-6 rounded-2xl font-academic-subheading">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--accent-gold)] mb-4 flex items-center space-x-2 font-serif-heading">
              <Users className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
              <span>Registered Student Profiles</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-academic-subheading">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--accent-gold)] uppercase tracking-wider font-bold font-serif-heading">
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Registration Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {adminStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--text-muted)] font-academic-subheading">
                        No students registered.
                      </td>
                    </tr>
                  )}
                  {adminStudents.map((stud) => (
                    <tr key={stud.id} className="hover:bg-[var(--bg-surface-subtle)] transition-all text-[var(--text-secondary)]">
                      <td className="py-3.5 px-4 font-mono">{stud.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)] font-academic-subheading">{stud.username}</td>
                      <td className="py-3.5 px-4">{stud.email}</td>
                      <td className="py-3.5 px-4">{new Date(stud.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteStudent(stud.id, stud.username)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer inline-flex items-center space-x-1.5 hover-scale disabled:opacity-50"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

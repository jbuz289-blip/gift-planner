import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Gift, DollarSign, CheckCircle, Circle, 
  Edit2, X, ShoppingBag, Package, AlertCircle, TrendingUp, Link as LinkIcon,
  User, Ruler, Heart, ShieldAlert, History, Tag, ExternalLink, Sparkles, Loader2, ArrowRight,
  Menu, ChevronDown, Users, Lock, Wallet, Calculator, Search, Lightbulb, ThumbsUp, MessageSquare,
  ArrowUpDown, GripVertical, FolderOpen, Settings, Download, Upload, FileJson, ChevronRight,
  PenTool, RefreshCw
} from 'lucide-react';

// --- Gemini API Helpers ---

// PRODUCTION READY: This looks for the key in your environment variables.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 

const generateGeminiGiftIdeas = async (person, budgetLeft) => {
  const prompt = `
    Act as a thoughtful personal shopper. Suggest 5 specific gift ideas for ${person.name}.
    Target Budget: Under £${budgetLeft > 0 ? budgetLeft : 50} (be flexible but realistic).
    
    User Profile:
    1. Basic Info: ${person.profile?.age ? person.profile.age + ' years old' : ''} ${person.profile?.sex || ''} (${person.profile?.relationship || 'Relation'})
    2. Problem to Solve (Highest Priority): ${person.profile?.problemToSolve || 'None'}
    3. Aesthetic/Style: ${person.profile?.aesthetics || 'None'}
    4. Current Obsession: ${person.profile?.obsession || 'None'}
    5. Do Not Buy (Strictly Avoid): ${person.profile?.doNotBuy || 'None'}
    6. Gift History (Avoid duplicates): ${person.profile?.giftHistory || 'None'}
    7. Sizes: Shirt: ${person.profile?.shirtSize || 'N/A'}, Shoe: ${person.profile?.shoeSize || 'N/A'}, Other: ${person.profile?.otherSize || 'N/A'}

    Output Requirements:
    Return ONLY a valid JSON array of objects. No markdown formatting.
    Schema:
    [
      {
        "name": "Product Name",
        "estimatedPrice": 25,
        "reason": "Why this matches their profile (max 10 words)",
        "searchQuery": "Specific search term to find this product online"
      }
    ]
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    console.error("Gemini Gen Error:", error);
    return [];
  }
};

const extractProfileFromText = async (text) => {
  const prompt = `
    Extract structured user profile data from the following unstructured text.
    Text: "${text}"
    
    Return a JSON object with these keys (use empty strings if not found):
    - age (string)
    - relationship (string)
    - sex (string: Male/Female/Other)
    - shirtSize (string)
    - shoeSize (string)
    - otherSize (string, e.g. Ring size)
    - aesthetics (string, comma separated)
    - obsession (string)
    - problemToSolve (string)
    - doNotBuy (string)
    - giftHistory (string)
    - shoppingLinks (string)
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    console.error("Extraction Error:", error);
    return null;
  }
};

const generateGeminiStrategy = async (person) => {
  const prompt = `
    Analyze this person's profile and provide a 2-sentence "Gifting Strategy" to help me find the perfect present.
    Person: ${person.name}
    Profile: ${JSON.stringify(person.profile)}
    
    Output ONLY the advice text. Keep it punchy, insightful, and helpful. Focus on connecting their 'Problem to Solve' with their 'Aesthetics'.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    return await response.json().then(data => data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    return "Could not generate strategy. Please try again.";
  }
};

const analyzeGiftMatch = async (person, giftName) => {
  const prompt = `
    Rate this gift idea for ${person.name} on a scale of 1-10 and explain why in 1 short sentence.
    Gift: ${giftName}
    Profile: ${JSON.stringify(person.profile)}
    
    Output Format: "Score: X/10. [Reasoning]"
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    return await response.json().then(data => data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    return "Analysis failed.";
  }
};

const generateGiftAlternatives = async (person, gift) => {
  const prompt = `
    Suggest 3 alternative gift ideas for ${person.name} that are similar to "${gift.name}" but distinct options.
    Current Gift Price: £${gift.price} (Keep alternatives in similar range).
    Profile: ${JSON.stringify(person.profile)}

    Output Requirements:
    Return ONLY a valid JSON array of objects.
    Schema:
    [ { "name": "Product Name", "estimatedPrice": 25, "category": "Category" } ]
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    return [];
  }
};

const generateCardMessage = async (person, gift) => {
  const prompt = `
    Write a short, warm, and witty gift card message for ${person.name} (${person.profile?.relationship || 'Friend'}) to go with their gift: "${gift.name}".
    Tone: Sincere but fun. Max 30 words.
    Output ONLY the message text.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error('API Error');
    return await response.json().then(data => data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    return "Hope you love it!";
  }
};

// --- UI Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", size = "md", disabled = false }) => {
  // MOBILE TWEAK: Increased min-height for better touch targets
  const baseStyle = "inline-flex items-center justify-center font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0";
  
  const variants = {
    primary: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-900 focus:ring-slate-500",
    outline: "border border-slate-300 hover:bg-slate-50 text-slate-700",
    ghost: "hover:bg-slate-100 text-slate-600",
    danger: "bg-rose-100 text-rose-700 hover:bg-rose-200 focus:ring-rose-500",
    gemini: "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white focus:ring-purple-500",
  };

  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    red: "bg-red-100 text-red-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Main Application ---

export default function App() {
  const loadState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Storage load error", e);
    }
    return defaultValue;
  };

  // CLEAN SLATE FOR PUBLISHING
  const defaultPeople = [];
  const defaultGifts = [];

  const [people, setPeople] = useState(() => loadState('xmas_people_v9', defaultPeople));
  const [gifts, setGifts] = useState(() => loadState('xmas_gifts_v9', defaultGifts));
  const [globalBudgetLimit, setGlobalBudgetLimit] = useState(() => loadState('xmas_global_limit_v9', 0));

  useEffect(() => {
    localStorage.setItem('xmas_people_v9', JSON.stringify(people));
    localStorage.setItem('xmas_gifts_v9', JSON.stringify(gifts));
    localStorage.setItem('xmas_global_limit_v9', JSON.stringify(globalBudgetLimit));
  }, [people, gifts, globalBudgetLimit]);

  const [activeTab, setActiveTab] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [generatingForId, setGeneratingForId] = useState(null); 
  const [analyzingGiftId, setAnalyzingGiftId] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [isBudgetManagerOpen, setIsBudgetManagerOpen] = useState(false);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [isReordering, setIsReordering] = useState(false);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const [newGift, setNewGift] = useState({ name: '', price: '', category: 'Fun', notes: '' });
  const [editingGiftId, setEditingGiftId] = useState(null); 
  const [newPerson, setNewPerson] = useState({ name: '', budget: '' });
  const [editingBudget, setEditingBudget] = useState(null);
  const [tempBudget, setTempBudget] = useState('');
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    age: '', relationship: '', sex: '',
    shirtSize: '', shoeSize: '', otherSize: '',
    aesthetics: '', obsession: '', problemToSolve: '',
    doNotBuy: '', giftHistory: '', shoppingLinks: ''
  });
  const [isEditingGlobalBudget, setIsEditingGlobalBudget] = useState(false);
  const [tempGlobalBudget, setTempGlobalBudget] = useState('');

  // New AI Feature States
  const [alternatives, setAlternatives] = useState([]);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);
  const [generatedCardMessage, setGeneratedCardMessage] = useState('');
  const [isWritingCard, setIsWritingCard] = useState(false);

  // --- Project Management Logic ---
  const loadProjects = () => {
    try {
      const saved = localStorage.getItem('gift_planner_projects');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return [] }
  };

  const [projects, setProjects] = useState(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isManageProjectsOpen, setIsManageProjectsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [tempEditName, setTempEditName] = useState('');
  
  useEffect(() => {
    const legacyPeople = localStorage.getItem('gift_planner_people_v1') || localStorage.getItem('xmas_people_v8');
    
    if (projects.length === 0) {
      const newProject = { id: 'default_' + Date.now(), name: 'My First Plan' };
      const newProjectsList = [newProject];
      setProjects(newProjectsList);
      setActiveProjectId(newProject.id);
      
      if (legacyPeople) {
        const legacyGifts = localStorage.getItem('gift_planner_gifts_v1') || localStorage.getItem('xmas_gifts_v8');
        const legacyLimit = localStorage.getItem('gift_planner_limit_v1') || localStorage.getItem('xmas_global_limit_v8');
        
        const projectData = {
          people: legacyPeople ? JSON.parse(legacyPeople) : [],
          gifts: legacyGifts ? JSON.parse(legacyGifts) : [],
          limit: legacyLimit ? JSON.parse(legacyLimit) : 0
        };
        localStorage.setItem(`gift_planner_data_${newProject.id}`, JSON.stringify(projectData));
      }
      localStorage.setItem('gift_planner_projects', JSON.stringify(newProjectsList));
    } else if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    const projectKey = `gift_planner_data_${activeProjectId}`;
    const savedData = localStorage.getItem(projectKey);
    
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setPeople(parsed.people || []);
      setGifts(parsed.gifts || []);
      setGlobalBudgetLimit(parsed.limit || 0);
    } else {
      setPeople([]); setGifts([]); setGlobalBudgetLimit(0);
    }
    setActiveTab(null);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    const projectData = { people, gifts, limit: globalBudgetLimit };
    localStorage.setItem(`gift_planner_data_${activeProjectId}`, JSON.stringify(projectData));
    localStorage.setItem('gift_planner_projects', JSON.stringify(projects));
  }, [people, gifts, globalBudgetLimit, projects, activeProjectId]);

  const stats = useMemo(() => {
    const totalPeopleBudget = people.reduce((acc, curr) => acc + curr.budget, 0);
    const totalSpent = gifts
      .filter(g => g.status === 'bought' || g.status === 'wrapped')
      .reduce((acc, curr) => acc + Number(curr.price), 0);
    const totalPlanned = gifts.reduce((acc, curr) => acc + Number(curr.price), 0);
    
    const giftsBought = gifts.filter(g => g.status === 'bought' || g.status === 'wrapped').length;
    const giftsWrapped = gifts.filter(g => g.status === 'wrapped').length;
    const totalGifts = gifts.length;

    return { totalPeopleBudget, totalSpent, totalPlanned, giftsBought, giftsWrapped, totalGifts };
  }, [people, gifts]);

  // --- Handlers ---
  const handleAddPerson = () => {
    if (!newPerson.name) return;
    const personId = Date.now();
    setPeople([...people, { 
      id: personId, 
      name: newPerson.name, 
      budget: Number(newPerson.budget) || 100,
      generatedIdeas: [],
      strategy: "",
      profile: { age: '', relationship: '', sex: '', shirtSize: '', shoeSize: '', otherSize: '', aesthetics: '', obsession: '', problemToSolve: '', doNotBuy: '', giftHistory: '', shoppingLinks: '' }
    }]);
    setNewPerson({ name: '', budget: '' });
    setIsAddPersonModalOpen(false);
    setActiveTab(personId);
    setIsMobileNavOpen(false);
  };

  const confirmDeletePerson = () => {
    if (!personToDelete) return;
    const newGifts = gifts.filter(g => g.personId !== personToDelete.id);
    setGifts(newGifts);
    const newPeople = people.filter(p => p.id !== personToDelete.id);
    setPeople(newPeople);
    if (activeTab === personToDelete.id) {
      if (newPeople.length > 0) setActiveTab(newPeople[0].id);
      else setActiveTab(null);
    }
    setPersonToDelete(null);
  };

  const handleSort = () => {
    let _people = [...people];
    const draggedItemContent = _people.splice(dragItem.current, 1)[0];
    _people.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setPeople(_people);
  };

  const openProfileModal = (person) => {
    setEditingProfileId(person.id);
    setProfileForm({ 
      ...person.profile,
      age: person.profile?.age || '',
      relationship: person.profile?.relationship || '',
      sex: person.profile?.sex || ''
    });
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = () => {
    setPeople(people.map(p => p.id === editingProfileId ? { ...p, profile: { ...profileForm } } : p));
    setIsProfileModalOpen(false);
  };

  const handleImportProfile = async () => {
    if (!importText || !editingProfileId) return;
    setIsImporting(true);
    const extractedData = await extractProfileFromText(importText);
    if (extractedData) {
      const currentPerson = people.find(p => p.id === editingProfileId);
      const mergedProfile = { ...currentPerson.profile };
      Object.keys(extractedData).forEach(key => {
        if (extractedData[key]) mergedProfile[key] = extractedData[key];
      });
      setPeople(people.map(p => p.id === editingProfileId ? { ...p, profile: mergedProfile } : p));
      setProfileForm(mergedProfile);
      setIsImporting(false);
      setIsImportModalOpen(false);
      setImportText('');
      setIsProfileModalOpen(true); 
    } else {
      setIsImporting(false);
      alert("Could not extract data. Please try again.");
    }
  };

  const handleGenerateIdeas = async (person) => {
    setGeneratingForId(person.id);
    const personGifts = gifts.filter(g => g.personId === person.id);
    const spentOrPlanned = personGifts.reduce((acc, curr) => acc + curr.price, 0);
    const budgetLeft = person.budget - spentOrPlanned;
    const ideas = await generateGeminiGiftIdeas(person, budgetLeft);
    setPeople(people.map(p => p.id === person.id ? { ...p, generatedIdeas: ideas } : p));
    setGeneratingForId(null);
  };

  const handleGenerateStrategy = async (person) => {
    setIsStrategyLoading(true);
    const strategy = await generateGeminiStrategy(person);
    setPeople(people.map(p => p.id === person.id ? { ...p, strategy: strategy } : p));
    setIsStrategyLoading(false);
  };

  const handleAnalyzeGift = async (person, gift) => {
    setAnalyzingGiftId(gift.id);
    const analysis = await analyzeGiftMatch(person, gift.name);
    setGifts(gifts.map(g => g.id === gift.id ? { ...g, analysis: analysis } : g));
    setAnalyzingGiftId(null);
  };

  const handleGenerateAlternatives = async () => {
    const person = people.find(p => p.id === activeTab);
    if (!newGift.name || !person) return;
    
    setIsGeneratingAlternatives(true);
    const alts = await generateGiftAlternatives(person, newGift);
    setAlternatives(alts || []);
    setIsGeneratingAlternatives(false);
  };

  const handleWriteCard = async () => {
    const person = people.find(p => p.id === activeTab);
    if (!newGift.name || !person) return;
    
    setIsWritingCard(true);
    const msg = await generateCardMessage(person, newGift);
    setGeneratedCardMessage(msg);
    setIsWritingCard(false);
  };

  const applyAlternative = (alt) => {
    setNewGift({
      ...newGift,
      name: alt.name,
      price: alt.estimatedPrice,
      category: alt.category || newGift.category
    });
    setAlternatives([]); // Clear list after selection
  };

  const convertIdeaToGift = (personId, idea) => {
    const plannedPrice = idea.estimatedPrice || 0;
    const gift = {
      id: Date.now(),
      personId: personId,
      name: idea.name,
      price: plannedPrice,
      status: 'idea',
      category: 'Fun', 
      notes: `Generated: ${idea.reason}\nSearch: https://www.google.com/search?q=${encodeURIComponent(idea.searchQuery || idea.name)}`,
      analysis: ''
    };
    setGifts([...gifts, gift]);
  };

  const deleteGeneratedIdea = (personId, indexToDelete) => {
    setPeople(people.map(p => {
      if (p.id !== personId) return p;
      const newIdeas = p.generatedIdeas.filter((_, idx) => idx !== indexToDelete);
      return { ...p, generatedIdeas: newIdeas };
    }));
  };

  const clearAllGeneratedIdeas = (personId) => {
    setPeople(people.map(p => p.id === personId ? { ...p, generatedIdeas: [] } : p));
  };

  const handleSaveGift = () => {
    if (!newGift.name) return;
    if (editingGiftId) {
      setGifts(gifts.map(g => g.id === editingGiftId ? { ...g, ...newGift, price: Number(newGift.price) } : g));
    } else {
      const gift = {
        id: Date.now(),
        personId: activeTab,
        name: newGift.name,
        price: Number(newGift.price),
        status: 'idea',
        category: newGift.category,
        notes: newGift.notes || '',
        analysis: ''
      };
      setGifts([...gifts, gift]);
    }
    setNewGift({ name: '', price: '', category: 'Fun', notes: '' });
    setEditingGiftId(null);
    setIsAddModalOpen(false);
    setAlternatives([]);
    setGeneratedCardMessage('');
  };

  const openAddModal = () => {
    setEditingGiftId(null);
    setNewGift({ name: '', price: '', category: 'Fun', notes: '' });
    setAlternatives([]);
    setGeneratedCardMessage('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (gift) => {
    setEditingGiftId(gift.id);
    setNewGift({ name: gift.name, price: gift.price, category: gift.category, notes: gift.notes || '' });
    setAlternatives([]);
    setGeneratedCardMessage('');
    setIsAddModalOpen(true);
  };

  const startEditingGlobalBudget = () => {
    setTempGlobalBudget(globalBudgetLimit);
    setIsEditingGlobalBudget(true);
  };

  const saveGlobalBudget = () => {
    const newLimit = Number(tempGlobalBudget);
    if (newLimit > 0) {
      setGlobalBudgetLimit(newLimit);
      setIsEditingGlobalBudget(false);
    }
  };

  const updateGiftStatus = (giftId) => {
    setGifts(gifts.map(g => {
      if (g.id !== giftId) return g;
      const statuses = ['idea', 'bought', 'wrapped'];
      const currentIndex = statuses.indexOf(g.status);
      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
      return { ...g, status: nextStatus };
    }));
  };

  const deleteGift = (giftId) => {
    setGifts(gifts.filter(g => g.id !== giftId));
  };

  const updateBudget = (personId) => {
    setPeople(people.map(p => p.id === personId ? { ...p, budget: Number(tempBudget) } : p));
    setEditingBudget(null);
  };

  const updateBudgetInConsole = (personId, newAmount) => {
    setPeople(people.map(p => p.id === personId ? { ...p, budget: Number(newAmount) } : p));
  };

  const getPersonStats = (personId) => {
    const personGifts = gifts.filter(g => g.personId === personId);
    const spent = personGifts
      .filter(g => g.status !== 'idea')
      .reduce((acc, curr) => acc + curr.price, 0);
    const planned = personGifts.reduce((acc, curr) => acc + curr.price, 0);
    return { spent, planned };
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'idea': return <Circle className="w-4 h-4" />;
      case 'bought': return <ShoppingBag className="w-4 h-4" />;
      case 'wrapped': return <Gift className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const getProjectedTotal = () => {
    const currentTotal = stats.totalPlanned;
    const newPrice = Number(newGift.price) || 0;
    if (editingGiftId) {
      const oldGift = gifts.find(g => g.id === editingGiftId);
      const oldPrice = oldGift ? oldGift.price : 0;
      return currentTotal - oldPrice + newPrice;
    } else {
      return currentTotal + newPrice;
    }
  };

  const projectedTotal = getProjectedTotal();
  const isProjectedOverBudget = projectedTotal > globalBudgetLimit;
  const overBudgetAmount = projectedTotal - globalBudgetLimit;
  const remainingGlobalBudget = globalBudgetLimit - stats.totalPlanned;
  const unallocatedBudget = globalBudgetLimit - stats.totalPeopleBudget;
  const activePerson = people.find(p => p.id === activeTab);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleCreateProject = () => {
    if (!newProjectName) return;
    const newProject = { id: 'proj_' + Date.now(), name: newProjectName };
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    setActiveProjectId(newProject.id); // Switch to it
    setNewProjectName('');
    setIsManageProjectsOpen(false);
  };

  const handleDeleteProject = (idToDelete) => {
    if (window.confirm("Are you sure? This will delete all gifts in this project.")) {
      const updatedProjects = projects.filter(p => p.id !== idToDelete);
      setProjects(updatedProjects);
      localStorage.removeItem(`gift_planner_data_${idToDelete}`);
      if (activeProjectId === idToDelete) {
         if (updatedProjects.length > 0) {
           setActiveProjectId(updatedProjects[0].id);
         } else {
           setActiveProjectId(null);
           setPeople([]); 
           setGifts([]);
         }
      }
    }
  };

  const handleStartEditProject = (project) => {
    setEditingProjectId(project.id);
    setTempEditName(project.name);
  };

  const handleSaveProjectName = (projectId) => {
    if (!tempEditName.trim()) return;
    const updatedProjects = projects.map(p => p.id === projectId ? { ...p, name: tempEditName } : p);
    setProjects(updatedProjects);
    setEditingProjectId(null);
    setTempEditName('');
  };

  const handleCancelEditProject = () => {
    setEditingProjectId(null);
    setTempEditName('');
  };

  const handleExportBackup = () => {
    const backupData = { projects: projects, projectData: {} };
    projects.forEach(p => {
      const key = `gift_planner_data_${p.id}`;
      backupData.projectData[key] = JSON.parse(localStorage.getItem(key) || '{"people":[], "gifts":[], "limit":0}');
    });
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gift_planner_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.projects || !Array.isArray(imported.projects)) { alert("Invalid backup file."); return; }
        if (window.confirm("This will overwrite your current projects. Are you sure?")) {
          setProjects(imported.projects);
          localStorage.setItem('gift_planner_projects', JSON.stringify(imported.projects));
          Object.keys(imported.projectData).forEach(key => { localStorage.setItem(key, JSON.stringify(imported.projectData[key])); });
          setActiveProjectId(imported.projects[0]?.id || null);
          setIsManageProjectsOpen(false);
          alert("Backup restored successfully!");
        }
      } catch (error) { console.error(error); alert("Error restoring file."); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-red-700 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3">
          
          {/* Row 1: Title & Project Switcher */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-red-200" />
              
              <div className="relative">
                <button 
                  onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                  className="flex items-center gap-2 font-bold text-lg hover:bg-red-800/50 px-2 py-1 rounded-lg transition-colors"
                >
                  <span className="truncate max-w-[150px] sm:max-w-xs">{activeProject ? activeProject.name : 'Loading...'}</span>
                  <ChevronDown className="w-4 h-4 text-red-200" />
                </button>

                {isProjectMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsProjectMenuOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-1 w-64 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 py-1 z-20">
                       <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Your Projects</div>
                       {projects.map(p => (
                         <button
                           key={p.id}
                           onClick={() => { setActiveProjectId(p.id); setIsProjectMenuOpen(false); }}
                           className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${p.id === activeProjectId ? 'text-red-600 font-medium bg-red-50' : ''}`}
                         >
                           {p.name}
                           {p.id === activeProjectId && <CheckCircle className="w-3.5 h-3.5" />}
                         </button>
                       ))}
                       <div className="border-t border-slate-100 mt-1 pt-1">
                         <button 
                           onClick={() => { setIsManageProjectsOpen(true); setIsProjectMenuOpen(false); }}
                           className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                         >
                           <Settings className="w-3.5 h-3.5" /> Manage Projects
                         </button>
                       </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Person Selector */}
            <div className="md:hidden relative">
              <button 
                onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                className="flex items-center gap-2 bg-red-800/50 hover:bg-red-800 px-3 py-1.5 rounded-lg transition-colors border border-red-600"
              >
                <Users className="w-4 h-4 text-red-200" />
                <span className="font-medium max-w-[100px] truncate text-sm">{activePerson ? activePerson.name : 'People'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isMobileNavOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isMobileNavOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMobileNavOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 max-h-[60vh] overflow-y-auto text-slate-900">
                    {people.map(person => (
                        <button
                          key={person.id}
                          onClick={() => { setActiveTab(person.id); setIsMobileNavOpen(false); }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between ${activeTab === person.id ? 'bg-red-50 text-red-700' : 'text-slate-700'}`}
                        >
                          <span className="font-medium">{person.name}</span>
                        </button>
                    ))}
                    <div className="border-t border-slate-100 mt-2 pt-2 px-2">
                       <button onClick={() => setIsAddPersonModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-colors">
                         <Plus className="w-4 h-4" /> Add Person
                       </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Financial Freedom Progress Bar & Budget Console Trigger */}
          <div>
             <div className="flex justify-between items-end text-xs text-red-100 mb-1">
                <div onClick={() => setIsBudgetManagerOpen(true)} className="flex items-center gap-2 group cursor-pointer hover:bg-red-800/30 rounded px-2 py-1 -ml-2 transition-colors">
                  <Wallet className="w-3.5 h-3.5 text-red-200" />
                  <span>Total Budget: <span className="font-bold border-b border-dashed border-red-300/50">£{globalBudgetLimit}</span></span>
                  <Edit2 className="w-3 h-3 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <span className={stats.totalPlanned > globalBudgetLimit ? "text-red-300 font-bold flex items-center gap-1" : "text-emerald-100 flex items-center gap-1"}>
                  {stats.totalPlanned > globalBudgetLimit 
                    ? <><AlertCircle className="w-3 h-3" /> Over by £{stats.totalPlanned - globalBudgetLimit}</> 
                    : `£${globalBudgetLimit - stats.totalPlanned} remaining`
                  }
                </span>
             </div>
             <div className="w-full h-2 bg-red-900/40 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${globalBudgetLimit > 0 && stats.totalPlanned > globalBudgetLimit ? 'bg-red-500 animate-pulse' : 'bg-green-400'}`}
                  style={{ width: `${globalBudgetLimit > 0 ? Math.min((stats.totalPlanned / globalBudgetLimit) * 100, 100) : 0}%` }}
                ></div>
             </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* Warning if over global budget */}
        {stats.totalPlanned > globalBudgetLimit && globalBudgetLimit > 0 && (
           <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm text-red-800 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-900 block mb-1">Budget Goal Exceeded</span>
                Your planned total of <strong>£{stats.totalPlanned}</strong> is currently <strong>£{stats.totalPlanned - globalBudgetLimit}</strong> over your goal of £{globalBudgetLimit}. 
                Consider removing items or adjusting individual budgets to stay on track for financial freedom.
              </div>
           </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Left (Allocated)</div>
            <div className={`text-xl font-bold ${stats.totalPeopleBudget - stats.totalSpent < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              £{stats.totalPeopleBudget - stats.totalSpent}
            </div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Planned Total</div>
            <div className="text-xl font-bold text-slate-800">£{stats.totalPlanned}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Purchased</div>
            <div className="text-xl font-bold text-blue-600">{stats.giftsBought}/{stats.totalGifts}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Wrapped</div>
            <div className="text-xl font-bold text-purple-600">{stats.giftsWrapped}/{stats.totalGifts}</div>
          </Card>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          
          {/* LEFT SIDEBAR (Desktop) */}
          <div className="hidden md:block w-64 flex-shrink-0 space-y-4 sticky top-36">
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                   <h3 className="font-bold text-slate-700 text-sm">People</h3>
                   <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setIsReordering(!isReordering)}
                        className={`p-1 rounded-md transition-colors ${isReordering ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                        title="Reorder List"
                        disabled={people.length < 2}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{people.length}</span>
                   </div>
                </div>
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {people.map((person, index) => {
                     const pStats = getPersonStats(person.id);
                     const budgetLeft = person.budget - pStats.spent;
                     const isOver = pStats.planned > person.budget;
                     
                     return (
                       <div 
                         key={person.id} 
                         draggable={isReordering}
                         onDragStart={() => (dragItem.current = index)}
                         onDragEnter={() => (dragOverItem.current = index)}
                         onDragEnd={handleSort}
                         onDragOver={(e) => e.preventDefault()}
                         className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all border-l-4 cursor-pointer hover:bg-slate-50 ${isReordering ? 'cursor-move' : ''} ${activeTab === person.id ? 'bg-red-50 border-red-500 text-red-900 font-medium' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                         onClick={() => !isReordering && setActiveTab(person.id)}
                       >
                         <span className="truncate">{person.name}</span>
                         
                         {isReordering ? (
                           <div className="text-slate-400">
                             <GripVertical className="w-4 h-4" />
                           </div>
                         ) : (
                           <div className="flex items-center gap-2">
                              {isOver && <AlertCircle className="w-3 h-3 text-red-500" />}
                              <span className={`w-2 h-2 rounded-full ${budgetLeft < 0 ? 'bg-red-400' : 'bg-emerald-400'}`} title={budgetLeft < 0 ? 'Over budget' : 'Under budget'}></span>
                           </div>
                         )}
                       </div>
                     );
                  })}
                  {people.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No people added yet.
                    </div>
                  )}
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <button onClick={() => setIsAddPersonModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Plus className="w-4 h-4" /> Add Person
                  </button>
                </div>
             </div>
             
             {/* Quick Stats Sidebar */}
             <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100 text-sm text-indigo-900">
                <h4 className="font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Pro Tip</h4>
                <p className="text-indigo-700/80 text-xs leading-relaxed">
                  Use the <strong>Generate Ideas</strong> button in a profile to let AI find gifts that match their specific interests!
                </p>
             </div>
          </div>

          {/* RIGHT CONTENT AREA */}
          <div className="flex-1 w-full min-w-0">
            {people.length > 0 ? (
              <Card className="overflow-hidden min-h-[500px]">
                {people.map(person => {
                  if (person.id !== activeTab) return null;
                  const personStats = getPersonStats(person.id);
                  const personGifts = gifts.filter(g => g.personId === person.id);
                  const budgetLeft = person.budget - personStats.spent;

                  return (
                    <div key={person.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
                      {/* Person Header */}
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <h2 className="text-xl font-bold text-slate-800">{person.name}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                              <Package className="w-4 h-4" />
                              <span>{personGifts.length} items planned</span>
                            </div>
                          </div>
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            <button onClick={() => openProfileModal(person)} className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm" title="Edit Gift Profile">
                              <User className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleGenerateIdeas(person)} disabled={generatingForId === person.id} className="p-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50" title="Generate Gift Ideas with AI">
                              {generatingForId === person.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setPersonToDelete(person)} className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm" title="Delete Person">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                          <div className="text-sm text-slate-500">Budget:</div>
                          {editingBudget === person.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" value={tempBudget} onChange={(e) => setTempBudget(e.target.value)} className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none" autoFocus />
                              <button onClick={() => updateBudget(person.id)} className="text-green-600 hover:text-green-700"><CheckCircle className="w-4 h-4" /></button>
                              <button onClick={() => setEditingBudget(null)} className="text-red-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setEditingBudget(person.id); setTempBudget(person.budget); }}>
                              <span className="font-semibold text-slate-900">£{person.budget}</span>
                              <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                            </div>
                          )}
                          <div className="w-px h-4 bg-slate-200 mx-1"></div>
                          <div className={`text-sm font-medium ${budgetLeft < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {budgetLeft < 0 ? '-' : '+'}£{Math.abs(budgetLeft)} left
                          </div>
                        </div>
                      </div>

                      {/* --- GIFT PROFILE SECTION --- */}
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex flex-col gap-3">
                          {/* Row 1: Bio & Sizes */}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">Bio:</span>
                              <span>
                                {person.profile?.age ? `${person.profile.age} yrs` : ''}
                                {person.profile?.age && (person.profile?.sex || person.profile?.relationship) ? ' • ' : ''}
                                {person.profile?.sex || ''}
                                {person.profile?.sex && person.profile?.relationship ? ' • ' : ''}
                                {person.profile?.relationship || 'Relation'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                              <Ruler className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">Sizes:</span>
                              <span>
                                {person.profile?.shirtSize ? `Shirt: ${person.profile.shirtSize}` : ''}
                                {person.profile?.shirtSize && person.profile?.shoeSize ? ' • ' : ''}
                                {person.profile?.shoeSize ? `Shoe: ${person.profile.shoeSize}` : ''}
                                {(person.profile?.shirtSize || person.profile?.shoeSize) && person.profile?.otherSize ? ' • ' : ''}
                                {person.profile?.otherSize || ( !person.profile?.shirtSize && !person.profile?.shoeSize ) ? (person.profile?.otherSize || 'No sizes set') : ''}
                              </span>
                            </div>
                          </div>

                          {/* Row 1.5: Aesthetics */}
                          {person.profile?.aesthetics && (
                            <div className="flex items-center gap-2 text-sm">
                              <Tag className="w-3.5 h-3.5 text-slate-400" />
                              <div className="flex flex-wrap gap-1">
                                {person.profile.aesthetics.split(',').map((tag, i) => (tag.trim() && <Badge key={i} color="rose">{tag.trim()}</Badge>))}
                              </div>
                            </div>
                          )}

                          {/* Row 2: Obsession & Problem */}
                          {(person.profile?.obsession || person.profile?.problemToSolve) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              {person.profile?.obsession && (
                                <div className="flex items-start gap-2 bg-indigo-50/50 p-2 rounded-lg text-indigo-900">
                                  <Heart className="w-4 h-4 text-indigo-400 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-xs uppercase tracking-wide text-indigo-400 block mb-0.5">Current Obsession</span>
                                    {person.profile.obsession}
                                  </div>
                                </div>
                              )}
                              {person.profile?.problemToSolve && (
                                <div className="flex items-start gap-2 bg-emerald-50/50 p-2 rounded-lg text-emerald-900">
                                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-xs uppercase tracking-wide text-emerald-400 block mb-0.5">Problem to Solve</span>
                                    {person.profile.problemToSolve}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Row 3: Do Not Buy & History */}
                          {(person.profile?.doNotBuy || person.profile?.giftHistory) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              {person.profile?.doNotBuy && (
                                <div className="flex items-start gap-2 bg-red-50/50 p-2 rounded-lg text-red-900">
                                  <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-xs uppercase tracking-wide text-red-400 block mb-0.5">Do Not Buy</span>
                                    {person.profile.doNotBuy}
                                  </div>
                                </div>
                              )}
                              {person.profile?.giftHistory && (
                                <div className="flex items-start gap-2 bg-slate-100/50 p-2 rounded-lg text-slate-700">
                                  <History className="w-4 h-4 text-slate-400 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-xs uppercase tracking-wide text-slate-400 block mb-0.5">Gift History</span>
                                    {person.profile.giftHistory}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Row 4: Shopping Links */}
                          {person.profile?.shoppingLinks && (
                            <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50/50 p-2 rounded-lg">
                                <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-blue-400" />
                                <div className="break-all">
                                  <span className="font-semibold text-xs uppercase tracking-wide text-blue-400 block mb-0.5">Shopping Links</span>
                                  {person.profile.shoppingLinks.split('\n').map((link, i) => (
                                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block hover:underline">{link}</a>
                                  ))}
                                </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gift List */}
                      <div className="divide-y divide-slate-100">
                        {personGifts.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No gift ideas yet for {person.name}.</p>
                            <Button onClick={openAddModal} variant="primary" className="mt-4">
                              Add First Idea
                            </Button>
                          </div>
                        ) : (
                          personGifts.map(gift => (
                            <div key={gift.id} className="p-4 flex flex-col hover:bg-slate-50 transition-colors group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                  <button onClick={() => updateGiftStatus(gift.id)} className="flex-shrink-0" title={`Current status: ${gift.status}. Click to advance.`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${gift.status === 'wrapped' ? 'bg-purple-100 text-purple-600 scale-110' : gift.status === 'bought' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                      {getStatusIcon(gift.status)}
                                    </div>
                                  </button>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h3 className={`font-medium text-slate-900 truncate ${gift.status === 'bought' || gift.status === 'wrapped' ? 'line-through decoration-slate-300 text-slate-500' : ''}`}>
                                      {gift.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <Badge color={gift.category === 'Health' ? 'green' : gift.category === 'Education' ? 'blue' : 'amber'}>{gift.category}</Badge>
                                      <span className="text-xs text-slate-500 capitalize">{gift.status}</span>
                                    </div>
                                    
                                    {/* Notes/Links Section */}
                                    {gift.notes && (
                                      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                                        <LinkIcon className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                        {gift.notes.startsWith('http') ? (
                                          <a href={gift.notes} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px] sm:max-w-xs block" onClick={(e) => e.stopPropagation()}>Open Link</a>
                                        ) : (
                                          <span className="text-slate-500 line-clamp-1">{gift.notes}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 pl-2">
                                  <span className="font-semibold text-slate-700 whitespace-nowrap">£{gift.price}</span>
                                  
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* AI Match Button */}
                                    <button 
                                      onClick={() => handleAnalyzeGift(person, gift)}
                                      className={`p-1.5 rounded transition-colors ${gift.analysis ? 'text-purple-600 bg-purple-50' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`}
                                      title={gift.analysis ? "View Analysis" : "Analyze Fit with AI"}
                                    >
                                      {analyzingGiftId === gift.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    </button>

                                    <a 
                                      href={`https://www.google.com/search?q=${encodeURIComponent(`${gift.name} ${!gift.notes?.startsWith('http') ? gift.notes : ''} ${gift.price ? '£' + gift.price : ''}`.trim())}`}
                                      target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Search on Google"
                                    >
                                      <Search className="w-4 h-4" />
                                    </a>

                                    <button onClick={() => openEditModal(gift)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteGift(gift.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {/* Display Analysis Result */}
                              {gift.analysis && (
                                <div className="mt-2 ml-14 bg-purple-50 p-2 rounded-lg text-xs text-purple-800 border border-purple-100 flex gap-2">
                                  <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>{gift.analysis}</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Button Footer */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button onClick={openAddModal} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                          <Plus className="w-5 h-5" />
                          Add Gift Idea for {person.name}
                        </button>
                      </div>

                      {/* --- AI Generated Ideas --- */}
                      {person.generatedIdeas && person.generatedIdeas.length > 0 && (
                        <div className="bg-indigo-50/50 border-t border-indigo-100">
                            <div className="px-4 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">AI Suggestions</h4>
                              </div>
                              <button onClick={() => clearAllGeneratedIdeas(person.id)} className="text-xs text-indigo-400 hover:text-red-500 font-medium transition-colors">Clear All</button>
                            </div>

                            <div className="px-4 pb-3 space-y-2">
                              {person.generatedIdeas.map((idea, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 shadow-sm group">
                                    <div className="flex-1 min-w-0 pr-3">
                                      <div className="flex items-center gap-2 mb-0.5">
                                          <span className="font-semibold text-slate-800 truncate">{idea.name}</span>
                                          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">~£{idea.estimatedPrice}</span>
                                      </div>
                                      <p className="text-xs text-slate-600 line-clamp-1">{idea.reason}</p>
                                      <a href={`https://www.google.com/search?q=${encodeURIComponent(idea.searchQuery || idea.name)}&tbm=shop`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-800 hover:underline flex items-center gap-1 mt-1">
                                        Search Online <ArrowRight className="w-3 h-3" />
                                      </a>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => convertIdeaToGift(person.id, idea)} className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors" title="Add to my list"><Plus className="w-4 h-4" /></button>
                                      <button onClick={() => deleteGeneratedIdea(person.id, idx)} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors" title="Dismiss"><X className="w-4 h-4" /></button>
                                    </div>
                                </div>
                              ))}
                            </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Welcome to Gift Planner</h3>
                <p className="text-slate-500 mb-6 max-w-sm">
                  {globalBudgetLimit === 0 
                    ? "Start by setting your total budget goal for this project." 
                    : "Start by adding people to your list to begin planning."}
                </p>
                
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  {globalBudgetLimit === 0 && (
                     <Button onClick={() => setIsBudgetManagerOpen(true)} variant="outline" className="w-full">
                       <Wallet className="w-4 h-4 mr-2" /> Set Total Budget
                     </Button>
                  )}
                  <Button onClick={() => setIsAddPersonModalOpen(true)} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Add First Person
                  </Button>
                </div>
              </div>
            )}

            {/* Smart Strategy Box (Replaces Static Inspiration) */}
            <div className="mt-6">
              {activePerson && (
                <Card className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-600" /> 
                            AI Gift Strategy for {activePerson.name}
                        </h3>
                        <button 
                          onClick={() => handleGenerateStrategy(activePerson)}
                          disabled={isStrategyLoading}
                          className="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-full font-medium border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {isStrategyLoading ? 'Thinking...' : activePerson.strategy ? 'Refresh Strategy' : 'Get Strategy'}
                        </button>
                    </div>
                    
                    {activePerson.strategy ? (
                      <div className="text-sm text-indigo-800 bg-white/60 p-4 rounded-lg border border-indigo-100 italic leading-relaxed animate-in fade-in">
                        "{activePerson.strategy}"
                      </div>
                    ) : (
                      <div className="text-sm text-indigo-600/70 text-center py-4">
                        Tap "Get Strategy" to generate personalized gifting advice based on {activePerson.name}'s profile.
                      </div>
                    )}
                </Card>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {personToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50">
              <h3 className="font-bold text-red-900 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Person?</h3>
              <button onClick={() => setPersonToDelete(null)} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-2">Are you sure you want to remove <strong>{personToDelete.name}</strong>?</p>
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>This will permanently delete all {gifts.filter(g => g.personId === personToDelete.id).length} gift ideas for them.</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <Button variant="secondary" onClick={() => setPersonToDelete(null)} className="flex-1">Cancel</Button>
              <Button onClick={confirmDeletePerson} variant="danger" className="flex-1">Delete</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Manage Projects Modal */}
      {isManageProjectsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
               <h3 className="font-bold text-slate-800 flex items-center gap-2"><FolderOpen className="w-5 h-5 text-indigo-600" /> Manage Projects</h3>
               <button onClick={() => setIsManageProjectsOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
               {/* Create New */}
               <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Create New Project</label>
                  <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={newProjectName}
                       onChange={(e) => setNewProjectName(e.target.value)}
                       placeholder="e.g. Birthday 2025"
                       className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                     <Button onClick={handleCreateProject} disabled={!newProjectName} className="whitespace-nowrap">Create</Button>
                  </div>
               </div>

               {/* List existing */}
               <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Projects</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                     {projects.map(p => (
                       <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg group">
                          {editingProjectId === p.id ? (
                            <div className="flex items-center gap-2 flex-1">
                                <input 
                                    type="text" 
                                    value={tempEditName}
                                    onChange={(e) => setTempEditName(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                />
                                <button onClick={() => handleSaveProjectName(p.id)} className="text-green-600 hover:text-green-700"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={handleCancelEditProject} className="text-red-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <>
                              <span className={`font-medium ${p.id === activeProjectId ? 'text-indigo-600' : 'text-slate-700'}`}>
                                {p.name} {p.id === activeProjectId && '(Active)'}
                              </span>
                              <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleStartEditProject(p)}
                                    className="text-slate-300 hover:text-indigo-500 transition-colors p-1"
                                    title="Rename Project"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteProject(p.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                    title="Delete Project"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                       </div>
                     ))}
                  </div>
               </div>

               {/* Backup & Restore */}
               <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Data Backup (Google Drive compatible)</h4>
                  <div className="flex gap-3">
                     <Button variant="outline" onClick={handleExportBackup} className="flex-1 text-xs h-9"><Download className="w-3.5 h-3.5 mr-2" /> Export Backup</Button>
                     <div className="relative flex-1">
                        <input type="file" accept=".json" onChange={handleImportBackup} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <Button variant="outline" className="w-full text-xs h-9"><Upload className="w-3.5 h-3.5 mr-2" /> Import Backup</Button>
                     </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">Save the exported file to Google Drive to share between devices.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Manager Modal */}
      {isBudgetManagerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-600" /> Budget Console</h3>
              <button onClick={() => setIsBudgetManagerOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                 <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Total Gift Budget (Ceiling)</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-indigo-500 font-bold">£</span></div>
                    <input type="number" value={globalBudgetLimit} onChange={(e) => setGlobalBudgetLimit(Number(e.target.value))} className="w-full pl-8 pr-3 py-3 text-lg font-bold text-indigo-900 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                 </div>
              </div>
              {/* Progress and List Code unchanged for brevity but included in compilation */}
              <div>
                 <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-slate-500 font-medium">Allocated Budget</span>
                    <span className={`font-bold ${unallocatedBudget < 0 ? 'text-red-600' : 'text-slate-700'}`}>£{stats.totalPeopleBudget} <span className="text-slate-400 font-normal">/ £{globalBudgetLimit}</span></span>
                 </div>
                 <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${unallocatedBudget < 0 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${globalBudgetLimit > 0 ? Math.min((stats.totalPeopleBudget / globalBudgetLimit) * 100, 100) : 0}%` }}></div>
                 </div>
                 <div className={`text-xs mt-1.5 text-right ${unallocatedBudget < 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>
                    {unallocatedBudget < 0 ? `Over-allocated by £${Math.abs(unallocatedBudget)}!` : `£${unallocatedBudget} remaining to allocate`}
                 </div>
              </div>
              <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Individual Allocations</h4>
                 <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {people.map(person => (
                      <div key={person.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                         <span className="font-medium text-slate-700">{person.name}</span>
                         <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">£</span>
                            <input type="number" value={person.budget} onChange={(e) => updateBudgetInConsole(person.id, e.target.value)} className="w-20 px-2 py-1 text-right border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium" />
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <Button onClick={() => setIsBudgetManagerOpen(false)} className="w-full">Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Import Profile Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-600" /> Import from Text</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Paste a message, email, or note about this person. AI will extract their profile details automatically.</p>
              <textarea 
                value={importText} 
                onChange={(e) => setImportText(e.target.value)} 
                placeholder="e.g. Charlotte is 34, my wife. She wears size 6 shoes and loves baking..." 
                className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm resize-none mb-4"
              />
              <Button 
                onClick={handleImportProfile} 
                disabled={!importText || isImporting} 
                className="w-full flex items-center justify-center gap-2"
                variant="gemini"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isImporting ? 'Analyzing...' : 'Extract & Save Profile'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800">Edit Gift Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              
              {/* Import Action */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg text-indigo-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900">Have a bio description?</h4>
                    <p className="text-xs text-indigo-700/80">Paste text to auto-fill this form.</p>
                  </div>
                </div>
                <Button 
                  onClick={() => { setIsProfileModalOpen(false); setIsImportModalOpen(true); }}
                  className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                  size="sm"
                >
                  Import
                </Button>
              </div>

              {/* New: Basic Info Section */}
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                 <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Basic Information</h4>
                 <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                      <input type="text" value={profileForm.age} onChange={e => setProfileForm({...profileForm, age: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. 34" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Sex</label>
                      <select value={profileForm.sex} onChange={e => setProfileForm({...profileForm, sex: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Relationship</label>
                      <input type="text" value={profileForm.relationship} onChange={e => setProfileForm({...profileForm, relationship: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Wife" />
                    </div>
                 </div>
              </div>

              <div className="space-y-3">
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sizes</h4>
                 <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Shirt/Dress</label><input type="text" value={profileForm.shirtSize} onChange={e => setProfileForm({...profileForm, shirtSize: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. M" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Shoe</label><input type="text" value={profileForm.shoeSize} onChange={e => setProfileForm({...profileForm, shoeSize: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. 6" /></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">Other (Ring/Hat)</label><input type="text" value={profileForm.otherSize} onChange={e => setProfileForm({...profileForm, otherSize: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Ring: L" /></div>
                 </div>
              </div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Aesthetic Tags</label><input type="text" value={profileForm.aesthetics} onChange={e => setProfileForm({...profileForm, aesthetics: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Minimalist, Rose Gold" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Obsession</label><input type="text" value={profileForm.obsession} onChange={e => setProfileForm({...profileForm, obsession: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Baking" /></div>
                 <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Problem to Solve</label><input type="text" value={profileForm.problemToSolve} onChange={e => setProfileForm({...profileForm, problemToSolve: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Back pain" /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">"Do Not Buy" List</label><input type="text" value={profileForm.doNotBuy} onChange={e => setProfileForm({...profileForm, doNotBuy: e.target.value})} className="w-full px-3 py-2 border border-red-200 bg-red-50 text-red-900 rounded-lg text-sm" placeholder="e.g. No more mugs" /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gift History</label><textarea value={profileForm.giftHistory} onChange={e => setProfileForm({...profileForm, giftHistory: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-16 resize-none" placeholder="Last year's gifts..." /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Shopping Links</label><textarea value={profileForm.shoppingLinks} onChange={e => setProfileForm({...profileForm, shoppingLinks: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-16 resize-none" placeholder="Pinterest links..." /></div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 flex-shrink-0 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveProfile} className="flex-1">Save Profile</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Person Modal */}
      {isAddPersonModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">Add Person</h3>
              <button onClick={() => setIsAddPersonModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input type="text" value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="e.g. Grandma" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" autoFocus /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Budget (£)</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-500 sm:text-sm">£</span></div><input type="number" value={newPerson.budget} onChange={(e) => setNewPerson({ ...newPerson, budget: e.target.value })} placeholder="100" className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" /></div></div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <Button variant="secondary" onClick={() => setIsAddPersonModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddPerson} className="flex-1">Add Person</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Gift Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingGiftId ? 'Edit Gift' : 'Add Gift'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {isProjectedOverBudget ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-1"><AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" /><div className="text-red-800"><span className="font-bold">Over Budget Warning:</span> This gift will push your total global spend <strong>£{overBudgetAmount}</strong> over your limit.</div></div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm flex items-start gap-2 text-emerald-800"><CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /><div>You have <strong>£{remainingGlobalBudget}</strong> left in your global budget.</div></div>
              )}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Gift Name</label><input type="text" value={newGift.name} onChange={(e) => setNewGift({ ...newGift, name: e.target.value })} placeholder="e.g. Football boots" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" autoFocus /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Estimated Price (£)</label><div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-500 sm:text-sm">£</span></div><input type="number" value={newGift.price} onChange={(e) => setNewGift({ ...newGift, price: e.target.value })} placeholder="0.00" className={`w-full pl-7 pr-3 py-2 border rounded-lg outline-none focus:ring-2 ${isProjectedOverBudget ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:ring-red-500 focus:border-red-500'}`} /></div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes / Link</label><textarea value={newGift.notes} onChange={(e) => setNewGift({ ...newGift, notes: e.target.value })} placeholder="Paste a link or add details..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none h-20 resize-none text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><div className="flex gap-2">{['Fun', 'Education', 'Health', 'Practical'].map(cat => (<button key={cat} onClick={() => setNewGift({ ...newGift, category: cat })} className={`flex-1 py-2 text-xs font-medium rounded-lg border ${newGift.category === cat ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{cat}</button>))}</div></div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveGift} className="flex-1" variant={isProjectedOverBudget ? "danger" : "primary"}>{editingGiftId ? 'Save Changes' : 'Add to List'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
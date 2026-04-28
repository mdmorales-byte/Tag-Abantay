import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, MapPin, Users, Bell, CloudRain, X, Menu, ChevronRight, Home, Send, Eye, Info } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { useAuth } from './hooks/useAuth';
import { useAlerts } from './hooks/useAlerts';
import { useCheckIns } from './hooks/useCheckIns';
import { notificationService } from './services/notificationService';
import { announcementService, galleryService } from './services/bulletinService';
import { checkInService } from './services/checkInService';

// Alert levels configuration
const ALERT_LEVELS = {
  0: { name: 'No Signal', color: 'bg-gray-600', icon: CloudRain },
  1: { name: 'Signal No. 1', color: 'bg-yellow-500', icon: AlertTriangle },
  2: { name: 'Signal No. 2', color: 'bg-orange-500', icon: AlertTriangle },
  3: { name: 'Signal No. 3', color: 'bg-red-500', icon: AlertTriangle },
  4: { name: 'Signal No. 4', color: 'bg-red-700', icon: AlertTriangle },
  5: { name: 'Signal No. 5', color: 'bg-red-900', icon: AlertTriangle }
};

// Main App Component
export default function TagAbantayApp() {
  const [currentPage, setCurrentPage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Use custom hooks
  const { user, isAuthenticated, isAdmin, signIn, signOut, loading: authLoading } = useAuth();
  const { currentAlert, alertInfo, isActive } = useAlerts();
  const { safetyStats, submitCheckIn, reloadStats } = useCheckIns();

  // Initialize notifications on mount
  useEffect(() => {
    notificationService.initialize();
    
    // Listen for in-app alerts
    const handleAlert = (event) => {
      console.log('Alert received:', event.detail);
    };
    window.addEventListener('tagabantay-alert', handleAlert);
    
    return () => {
      window.removeEventListener('tagabantay-alert', handleAlert);
    };
  }, []);

  // Send notification when alert level changes
  useEffect(() => {
    if (isActive && currentAlert) {
      notificationService.sendAlert({
        title: `${alertInfo.name} - ${currentAlert.typhoon_name}`,
        message: alertInfo.description,
        priority: currentAlert.signal_level >= 3 ? 'urgent' : 'normal'
      });
    }
  }, [currentAlert, isActive, alertInfo]);

  const handleLogin = async (email, password) => {
    const result = await signIn(email, password);
    if (result.success) {
      setCurrentPage('dashboard');
    }
    return result;
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentPage('home');
  };

  // Transform alert data for components
  const typhoonAlert = {
    level: currentAlert?.signal_level || 0,
    name: currentAlert?.typhoon_name || '',
    updated: currentAlert?.updated_at || new Date().toLocaleString()
  };

  // DISABLED: Loading screen causing infinite loop
  // if (authLoading) {
  //   return (
  //     <div className="min-h-screen bg-slate-900 flex items-center justify-center">
  //       <div className="text-cyan-400 text-xl">Loading...</div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <Navigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isLoggedIn={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        typhoonAlert={typhoonAlert}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Content */}
      <main className="pt-20">
        {currentPage === 'home' && <HomePage setCurrentPage={setCurrentPage} typhoonAlert={typhoonAlert} />}
        {currentPage === 'alerts' && <AlertsPage typhoonAlert={typhoonAlert} alertInfo={alertInfo} />}
        {currentPage === 'map' && <EvacuationMapPage />}
        {currentPage === 'login' && !isAuthenticated && <LoginPage handleLogin={handleLogin} setCurrentPage={setCurrentPage} />}
        {currentPage === 'dashboard' && isAuthenticated && (
          isAdmin ? 
            <AdminDashboard safetyStats={safetyStats} /> : 
            <StudentDashboard safetyStats={safetyStats} />
        )}
        {currentPage === 'checkin' && isAuthenticated && <CheckInPage submitCheckIn={submitCheckIn} />}
        {currentPage === 'about' && <AboutUsPage />}
      </main>
    </div>
  );
}

// Navigation Component
function Navigation({ currentPage, setCurrentPage, isLoggedIn, user, handleLogout, typhoonAlert, mobileMenuOpen, setMobileMenuOpen }) {
  const alertLevel = ALERT_LEVELS[typhoonAlert.level];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentPage('home')}>
              <img src="https://i.imgur.com/SPc6uhg.png" alt="AdNU Logo" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Tag-Abantay</h1>
                <p className="text-xs text-cyan-300 tracking-wide">AdNU Safety System</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              <NavButton active={currentPage === 'home'} onClick={() => setCurrentPage('home')} icon={Home}>
                Home
              </NavButton>
              <NavButton active={currentPage === 'alerts'} onClick={() => setCurrentPage('alerts')} icon={Bell}>
                Alerts
              </NavButton>
              <NavButton active={currentPage === 'map'} onClick={() => setCurrentPage('map')} icon={MapPin}>
                Map
              </NavButton>
              <NavButton active={currentPage === 'about'} onClick={() => setCurrentPage('about')} icon={Info}>
                About
              </NavButton>
              {isLoggedIn && (
                <>
                  <NavButton active={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} icon={Users}>
                    Dashboard
                  </NavButton>
                  <NavButton active={currentPage === 'checkin'} onClick={() => setCurrentPage('checkin')} icon={Shield}>
                    Check-In
                  </NavButton>
                </>
              )}
            </div>

            {/* Auth Section */}
            <div className="hidden md:flex items-center space-x-4">
              {!isLoggedIn ? (
                <button
                  onClick={() => setCurrentPage('login')}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30"
                >
                  Login
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">{user?.email}</p>
                    <p className="text-xs text-cyan-300">
                      {user?.email?.includes('admin') ? 'Administrator' : 'AdNU Student'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-lg transition-all duration-200"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Alert Banner */}
          {typhoonAlert.level > 0 && (
            <div className={`${alertLevel.color} text-white px-4 py-2 mb-0 -mx-4 flex items-center justify-center space-x-2 animate-pulse`}>
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">{alertLevel.name} - {typhoonAlert.name}</span>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/98 backdrop-blur-lg pt-24 px-6">
          <div className="flex flex-col space-y-3">
            <MobileNavButton onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false); }}>Home</MobileNavButton>
            <MobileNavButton onClick={() => { setCurrentPage('alerts'); setMobileMenuOpen(false); }}>Alerts</MobileNavButton>
            <MobileNavButton onClick={() => { setCurrentPage('map'); setMobileMenuOpen(false); }}>Evacuation Map</MobileNavButton>
            <MobileNavButton onClick={() => { setCurrentPage('about'); setMobileMenuOpen(false); }}>About Us</MobileNavButton>
            {isLoggedIn && (
              <>
                <MobileNavButton onClick={() => { setCurrentPage('dashboard'); setMobileMenuOpen(false); }}>Dashboard</MobileNavButton>
                <MobileNavButton onClick={() => { setCurrentPage('checkin'); setMobileMenuOpen(false); }}>Check-In</MobileNavButton>
              </>
            )}
            <div className="pt-4 border-t border-slate-700">
              {!isLoggedIn ? (
                <button
                  onClick={() => { setCurrentPage('login'); setMobileMenuOpen(false); }}
                  className="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg"
                >
                  Login with AdNU Account
                </button>
              ) : (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
        active
          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
          : 'text-gray-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </button>
  );
}

function MobileNavButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all duration-200"
    >
      {children}
    </button>
  );
}

function HomePage({ setCurrentPage, typhoonAlert }) {
  const alertLevel = ALERT_LEVELS[typhoonAlert.level];
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
    
    // Subscribe to real-time updates
    const subscription = announcementService.subscribeToChanges(() => {
      loadAnnouncements();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadAnnouncements = async () => {
    const result = await announcementService.getLatest(5);
    if (result.success) {
      setAnnouncements(result.data || []);
    }
    setLoadingAnnouncements(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16 animate-fadeIn">
        <div className="inline-block mb-6">
          <img src="https://i.imgur.com/SPc6uhg.png" alt="AdNU Logo" className="w-24 h-24 mx-auto mb-4 rounded-full object-cover" />
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
          Tag-Abantay
        </h1>
        <p className="text-xl md:text-2xl text-cyan-300 mb-4 font-light">
          Typhoon Safety Monitoring System
        </p>
        <p className="text-lg text-gray-400 max-w-3xl mx-auto">
          Real-time safety monitoring for the Ateneo de Naga University community during typhoon events.
          Stay informed, stay safe, stay connected.
        </p>
      </div>

      {/* Current Alert */}
      {typhoonAlert.level > 0 && (
        <div className={`${alertLevel.color} text-white rounded-2xl p-8 mb-12 shadow-2xl`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <AlertTriangle className="w-12 h-12" />
              <div>
                <h2 className="text-3xl font-bold">{alertLevel.name}</h2>
                <p className="text-lg opacity-90">{typhoonAlert.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">Last Updated</p>
              <p className="font-semibold">{typhoonAlert.updated}</p>
            </div>
          </div>
          <p className="text-sm opacity-90">
            Please stay safe and follow official evacuation procedures. Check in to let us know you're safe.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <ActionCard
          icon={Bell}
          title="View Alerts"
          description="Current typhoon signals and weather updates"
          onClick={() => setCurrentPage('alerts')}
          color="bg-gradient-to-br from-yellow-500 to-orange-600"
        />
        <ActionCard
          icon={MapPin}
          title="Evacuation Map"
          description="Find safe routes and evacuation centers"
          onClick={() => setCurrentPage('map')}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <ActionCard
          icon={Shield}
          title="Safety Check-In"
          description="Report your safety status"
          onClick={() => setCurrentPage('login')}
          color="bg-gradient-to-br from-cyan-500 to-blue-600"
        />
      </div>

      {/* Bulletin / Announcements Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left - Image Gallery */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="text-xs font-semibold tracking-wider text-cyan-400 uppercase">Now Happening</p>
              <p className="text-xs text-gray-500">(AdNU Updates)</p>
            </div>
            <BulletinGallery />
          </div>
          
          {/* Right - Announcements */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Bell className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-semibold tracking-wider text-cyan-400 uppercase">Bulletin</p>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Latest Announcement</h3>
            <div className="space-y-4">
              {loadingAnnouncements ? (
                <p className="text-gray-400">Loading announcements...</p>
              ) : announcements.length === 0 ? (
                <p className="text-gray-400">No announcements yet.</p>
              ) : (
                announcements.map((announcement) => (
                  <AnnouncementCard 
                    key={announcement.id}
                    title={announcement.title}
                    date={formatDate(announcement.created_at)}
                    description={announcement.content}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">System Features</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <FeatureItem
            icon={Bell}
            title="Real-Time Alerts"
            description="Automated notifications based on PAGASA typhoon signals"
          />
          <FeatureItem
            icon={MapPin}
            title="Interactive Maps"
            description="Campus evacuation routes and safe zones"
          />
          <FeatureItem
            icon={Users}
            title="Community Monitoring"
            description="Track safety status of students and faculty"
          />
          <FeatureItem
            icon={Shield}
            title="Secure Access"
            description="AdNU institutional login with encrypted data"
          />
        </div>
      </div>
    </div>
  );
}

function BulletinGallery() {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Fetch images from Supabase on mount
  useEffect(() => {
    loadImages();
    
    // Subscribe to real-time updates
    const subscription = galleryService.subscribeToChanges(() => {
      loadImages();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadImages = async () => {
    const result = await galleryService.getAll();
    if (result.success) {
      setImages(result.data || []);
    }
    setLoading(false);
  };
  
  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  if (loading) {
    return <div className="text-gray-400">Loading gallery...</div>;
  }
  
  if (images.length === 0) {
    return <div className="text-gray-400">No images available</div>;
  }
  
  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-700">
        <img 
          src={images[currentIndex]?.url}
          alt={images[currentIndex]?.caption}
          className="w-full h-full object-cover"
        />
        
        {/* Navigation Arrows */}
        <button 
          onClick={prevImage}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <button 
          onClick={nextImage}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {/* Caption */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-white text-sm">{images[currentIndex]?.caption}</p>
        </div>
      </div>
      
      {/* Dots */}
      <div className="flex justify-center space-x-2 mt-3">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? 'bg-cyan-400 w-4' : 'bg-gray-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function AnnouncementCard({ title, date, description }) {
  return (
    <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50 hover:border-cyan-500/30 transition-all">
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <p className="text-xs text-cyan-400 mb-2">{date}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function ActionCard({ icon: Icon, title, description, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white rounded-xl p-6 shadow-xl hover:scale-105 transition-all duration-300 text-left group`}
    >
      <Icon className="w-12 h-12 mb-4 group-hover:scale-110 transition-transform duration-300" />
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm opacity-90">{description}</p>
      <ChevronRight className="w-6 h-6 mt-4 group-hover:translate-x-2 transition-transform duration-300" />
    </button>
  );
}

function FeatureItem({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start space-x-4">
      <div className="bg-cyan-500/20 p-3 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

// Alerts Page
function AlertsPage({ typhoonAlert }) {
  const alertLevel = ALERT_LEVELS[typhoonAlert.level];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Typhoon Alerts</h1>

      {/* Current Alert */}
      <div className={`${alertLevel.color} text-white rounded-2xl p-8 mb-8 shadow-2xl`}>
        <div className="flex items-center space-x-4 mb-6">
          <AlertTriangle className="w-16 h-16" />
          <div>
            <h2 className="text-4xl font-bold">{alertLevel.name}</h2>
            <p className="text-xl opacity-90">{typhoonAlert.name}</p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <p><strong>Location:</strong> Naga City, Camarines Sur</p>
          <p><strong>Last Updated:</strong> {typhoonAlert.updated}</p>
          <p><strong>Status:</strong> Active monitoring in progress</p>
        </div>
      </div>

      {/* Safety Guidelines */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-6">Safety Guidelines</h2>
        <div className="space-y-4 text-gray-300">
          <SafetyGuideline>Stay indoors and avoid unnecessary travel</SafetyGuideline>
          <SafetyGuideline>Keep emergency supplies ready (food, water, flashlight)</SafetyGuideline>
          <SafetyGuideline>Monitor official weather updates from PAGASA</SafetyGuideline>
          <SafetyGuideline>Report your safety status through the check-in system</SafetyGuideline>
          <SafetyGuideline>Follow evacuation orders from local authorities</SafetyGuideline>
        </div>
      </div>
    </div>
  );
}

function SafetyGuideline({ children }) {
  return (
    <div className="flex items-start space-x-3">
      <div className="bg-cyan-500/20 p-2 rounded-lg mt-0.5">
        <ChevronRight className="w-4 h-4 text-cyan-400" />
      </div>
      <p>{children}</p>
    </div>
  );
}

// Evacuation Map Page
function EvacuationMapPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Evacuation Map</h1>

      {/* Map Placeholder */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 mb-8">
        <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-xl h-96 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-white text-lg">Interactive Map Component</p>
            <p className="text-gray-400 text-sm mt-2">OpenStreetMap + Leaflet.js Integration</p>
          </div>
        </div>
      </div>

      {/* Evacuation Centers */}
      <div className="grid md:grid-cols-2 gap-6">
        <EvacuationCenter
          name="AdNU Gym"
          capacity="500 persons"
          distance="0.2 km"
          status="Available"
        />
        <EvacuationCenter
          name="Naga City Coliseum"
          capacity="1,000 persons"
          distance="1.5 km"
          status="Available"
        />
        <EvacuationCenter
          name="Barangay Hall - Concepcion Grande"
          capacity="200 persons"
          distance="2.1 km"
          status="Available"
        />
        <EvacuationCenter
          name="SM City Naga"
          capacity="800 persons"
          distance="3.2 km"
          status="Available"
        />
      </div>
    </div>
  );
}

function EvacuationCenter({ name, capacity, distance, status }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-green-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
          <p className="text-sm text-gray-400">{distance} from campus</p>
        </div>
        <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
          {status}
        </span>
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-300">
        <Users className="w-4 h-4" />
        <span>Capacity: {capacity}</span>
      </div>
    </div>
  );
}

// Login Page
function LoginPage({ handleLogin, setCurrentPage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('Attempting login with:', email);
    
    try {
      const result = await handleLogin(email, password);
      console.log('Login result:', result);
      
      if (!result.success) {
        setError(result.error?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <div className="text-center mb-8">
          <img src="https://i.imgur.com/SPc6uhg.png" alt="AdNU Logo" className="w-16 h-16 mx-auto mb-4 rounded-full object-cover" />
          <h1 className="text-3xl font-bold text-white mb-2">AdNU Login</h1>
          <p className="text-gray-400">Sign in with your institutional account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.name@adnu.edu.ph"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentPage('home')}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ safetyStats }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const { updatePassword } = useAuth();

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setUpdating(true);
    const result = await updatePassword(newPassword);
    if (result.success) {
      alert('Password set successfully! You can now log in with email and password.');
      setShowPasswordForm(false);
      setNewPassword('');
    } else {
      alert('Failed to set password: ' + result.error?.message);
    }
    setUpdating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Student Dashboard</h1>

      {/* Set Password Banner */}
      {!showPasswordForm && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 font-semibold">No Password Set</p>
              <p className="text-gray-300 text-sm">Set a password so you can log in without magic link</p>
            </div>
            <button
              onClick={() => setShowPasswordForm(true)}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white font-semibold rounded-lg transition-all"
            >
              Set Password
            </button>
          </div>
        </div>
      )}

      {/* Password Form */}
      {showPasswordForm && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-6">
          <form onSubmit={handleSetPassword} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Password (min 6 characters)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={updating}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {updating ? 'Saving...' : 'Save Password'}
            </button>
            <button
              type="button"
              onClick={() => setShowPasswordForm(false)}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Safe" value={safetyStats.safe} color="bg-green-500" icon={Shield} />
        <StatCard title="Needs Help" value={safetyStats.needsHelp} color="bg-red-500" icon={AlertTriangle} />
        <StatCard title="Unreachable" value={safetyStats.unreachable} color="bg-orange-500" icon={Eye} />
        <StatCard title="Not Reported" value={safetyStats.notReported} color="bg-gray-600" icon={Users} />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <QuickActionButton icon={Shield}>Submit Check-In</QuickActionButton>
          <QuickActionButton icon={Send}>Report Incident</QuickActionButton>
          <QuickActionButton icon={MapPin}>View Evacuation Routes</QuickActionButton>
          <QuickActionButton icon={Bell}>View Alerts</QuickActionButton>
        </div>
      </div>

      {/* My Status */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-4">My Safety Status</h2>
        <p className="text-gray-400">Submit a check-in to update your status</p>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, icon: Icon, onClick, isSelected }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:bg-slate-700/50 hover:border-cyan-500/50' : ''
      } ${isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-3xl font-bold text-white">{value}</span>
      </div>
      <p className="text-gray-400 text-sm">{title}</p>
    </div>
  );
}

function QuickActionButton({ icon: Icon, children }) {
  return (
    <button className="flex items-center space-x-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200">
      <Icon className="w-5 h-5" />
      <span className="font-medium">{children}</span>
    </button>
  );
}

// Check-In Page
function CheckInPage({ submitCheckIn }) {
  const [status, setStatus] = useState('safe');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    const result = await submitCheckIn({
      status,
      location,
      notes
    });
    
    if (result.success) {
      alert('Check-in submitted successfully!');
      // Reset form
      setStatus('safe');
      setLocation('');
      setNotes('');
    } else {
      alert('Failed to submit check-in. Please try again.');
    }
    
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Safety Check-In</h1>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-lg font-medium text-white mb-4">
              Current Status
            </label>
            <div className="grid md:grid-cols-3 gap-4">
              <StatusButton
                selected={status === 'safe'}
                onClick={() => setStatus('safe')}
                color="bg-green-500"
                label="Safe"
              />
              <StatusButton
                selected={status === 'help'}
                onClick={() => setStatus('help')}
                color="bg-red-500"
                label="Need Help"
              />
              <StatusButton
                selected={status === 'unreachable'}
                onClick={() => setStatus('unreachable')}
                color="bg-orange-500"
                label="Unreachable"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Current Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Home, Boarding House, Evacuation Center"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30"
          >
            Submit Check-In
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusButton({ selected, onClick, color, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
        selected
          ? `${color} text-white shadow-lg`
          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

// Admin Dashboard
function AdminDashboard({ safetyStats: initialStats }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [safetyStats, setSafetyStats] = useState(initialStats || { safe: 0, needsHelp: 0, unreachable: 0, notReported: 0 });

  // Fetch real check-ins and stats on mount
  useEffect(() => {
    loadCheckIns();
    loadSafetyStats();

    // Safety timeout - force loading to false after 5 seconds
    const timeoutId = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.log('AdminDashboard: Forcing loading to false after timeout');
          return false;
        }
        return current;
      });
    }, 5000);

    // Subscribe to real-time updates - with error handling
    let subscription = null;
    try {
      subscription = checkInService.subscribeToCheckIns((payload) => {
        console.log('New check-in:', payload);
        loadCheckIns();
        loadSafetyStats();
      });
    } catch (err) {
      console.error('Failed to subscribe to check-ins:', err);
    }

    return () => {
      clearTimeout(timeoutId);
      if (subscription) {
        try {
          checkInService.unsubscribeFromCheckIns(subscription);
        } catch (e) {
          console.warn('Error unsubscribing:', e);
        }
      }
    };
  }, []);

  const loadCheckIns = async () => {
    setLoading(true);
    try {
      const result = await checkInService.getAllCheckIns(50);
      if (result.data) {
        setCheckIns(result.data);
      }
    } catch (err) {
      console.error('Error loading check-ins:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSafetyStats = async () => {
    try {
      const result = await checkInService.getSafetyStats();
      if (result.data) {
        setSafetyStats({
          safe: result.data.safe,
          needsHelp: result.data.need_help,
          unreachable: result.data.unreachable,
          notReported: result.data.not_reported
        });
      }
    } catch (err) {
      console.error('Error loading safety stats:', err);
    }
  };

  // Handle stat card click to filter users by status
  const handleStatClick = (status) => {
    setSelectedStatus(status);
    
    // Filter check-ins by status
    const filtered = checkIns.filter(checkIn => {
      const checkInStatus = checkIn.status?.toLowerCase().replace('_', '');
      const targetStatus = status.toLowerCase().replace(' ', '');
      
      if (status === 'Safe') return checkIn.status === 'safe';
      if (status === 'Needs Help') return checkIn.status === 'need_help' || checkIn.status === 'needs_help';
      if (status === 'Unreachable') return checkIn.status === 'unreachable';
      if (status === 'Not Reported') {
        // For not reported, we need to find users without recent check-ins
        return false; // Handle separately
      }
      return false;
    });
    
    setFilteredUsers(filtered);
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Get status color
  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'safe') return 'text-green-500';
    if (s === 'need_help' || s === 'needs_help') return 'text-red-500';
    if (s === 'unreachable') return 'text-orange-500';
    return 'text-gray-400';
  };

  // Get status display name
  const getStatusDisplay = (status) => {
    const s = status?.toLowerCase();
    if (s === 'safe') return 'Safe';
    if (s === 'need_help' || s === 'needs_help') return 'Needs Help';
    if (s === 'unreachable') return 'Unreachable';
    return status;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
        <button className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all duration-200">
          Broadcast Alert
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-8 bg-slate-800/50 p-2 rounded-xl">
        <AdminTab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={Shield}>
          Overview
        </AdminTab>
        <AdminTab active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} icon={Bell}>
          Announcements
        </AdminTab>
        <AdminTab active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={Eye}>
          Gallery
        </AdminTab>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Safe" 
              value={safetyStats.safe} 
              color="bg-green-500" 
              icon={Shield} 
              onClick={() => handleStatClick('Safe')}
              isSelected={selectedStatus === 'Safe'}
            />
            <StatCard 
              title="Needs Help" 
              value={safetyStats.needsHelp} 
              color="bg-red-500" 
              icon={AlertTriangle} 
              onClick={() => handleStatClick('Needs Help')}
              isSelected={selectedStatus === 'Needs Help'}
            />
            <StatCard 
              title="Unreachable" 
              value={safetyStats.unreachable} 
              color="bg-orange-500" 
              icon={Eye} 
              onClick={() => handleStatClick('Unreachable')}
              isSelected={selectedStatus === 'Unreachable'}
            />
            <StatCard 
              title="Not Reported" 
              value={safetyStats.notReported} 
              color="bg-gray-600" 
              icon={Users} 
              onClick={() => handleStatClick('Not Reported')}
              isSelected={selectedStatus === 'Not Reported'}
            />
          </div>

          {/* User Details Panel - Shows when a status card is clicked */}
          {selectedStatus && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {selectedStatus} Users ({filteredUsers.length})
                </h2>
                <button 
                  onClick={() => setSelectedStatus(null)}
                  className="text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              
              {filteredUsers.length === 0 ? (
                <p className="text-gray-400">No users with this status.</p>
              ) : (
                <div className="grid gap-4 max-h-96 overflow-y-auto">
                  {filteredUsers.map((checkIn, index) => (
                    <div key={index} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white">
                            {checkIn.users?.full_name || checkIn.users?.email || 'Unknown User'}
                          </h3>
                          <p className={`text-sm ${getStatusColor(checkIn.status)}`}>
                            {getStatusDisplay(checkIn.status)}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(checkIn.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {checkIn.location && (
                          <p className="text-gray-400">
                            Location: {checkIn.location}
                          </p>
                        )}
                        {checkIn.notes && (
                          <p className="text-gray-400">
                            Notes: {checkIn.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Check-Ins */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Check-Ins</h2>
            <div className="overflow-x-auto">
              {loading ? (
                <p className="text-gray-400">Loading check-ins...</p>
              ) : checkIns.length === 0 ? (
                <p className="text-gray-400">No check-ins yet. Data will appear here when students submit their status.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Location</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.slice(0, 10).map((checkIn, index) => (
                      <CheckInRow
                        key={index}
                        name={checkIn.users?.full_name || checkIn.users?.email || 'Unknown'}
                        status={getStatusDisplay(checkIn.status)}
                        statusColor={getStatusColor(checkIn.status)}
                        location={checkIn.location || 'Not specified'}
                        time={formatTimeAgo(checkIn.created_at)}
                        notes={checkIn.notes}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'announcements' && <AdminAnnouncements />}
      {activeTab === 'gallery' && <AdminGallery />}
    </div>
  );
}

function AdminTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        active
          ? 'bg-cyan-500 text-white shadow-lg'
          : 'text-gray-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{children}</span>
    </button>
  );
}

function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '' });

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
    
    // Subscribe to real-time updates
    const subscription = announcementService.subscribeToChanges(() => {
      loadAnnouncements();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadAnnouncements = async () => {
    const result = await announcementService.getAll();
    if (result.success) {
      setAnnouncements(result.data || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({ title: '', content: '' });
  };

  const handleEdit = (announcement) => {
    setIsEditing(true);
    setEditingId(announcement.id);
    setFormData({ title: announcement.title, content: announcement.content });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    const result = await announcementService.delete(id);
    if (result.success) {
      setAnnouncements(announcements.filter(a => a.id !== id));
    } else {
      alert('Failed to delete announcement');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      const result = await announcementService.update(editingId, formData);
      if (result.success) {
        setAnnouncements(announcements.map(a => 
          a.id === editingId ? { ...a, ...formData, updated_at: new Date().toISOString() } : a
        ));
      }
    } else {
      const result = await announcementService.create(formData);
      if (result.success && result.data) {
        setAnnouncements([result.data, ...announcements]);
      }
    }
    
    setIsEditing(false);
    setFormData({ title: '', content: '' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="text-white">Loading announcements...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Manage Announcements</h2>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg transition-all"
        >
          <span>+</span>
          <span>Add New</span>
        </button>
      </div>

      {isEditing && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Announcement' : 'Add New Announcement'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white resize-none"
                rows={3}
                required
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" className="px-6 py-2 bg-cyan-500 text-white rounded-lg">
                Save
              </button>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <p className="text-gray-400">No announcements yet. Click "Add New" to create one.</p>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{announcement.title}</h3>
                  <p className="text-xs text-cyan-400 mb-2">
                    {formatDate(announcement.created_at)}
                  </p>
                  <p className="text-gray-400 text-sm">{announcement.content}</p>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(announcement)}
                    className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');

  // Fetch images on mount
  useEffect(() => {
    loadImages();
    
    // Subscribe to real-time updates
    const subscription = galleryService.subscribeToChanges(() => {
      loadImages();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadImages = async () => {
    const result = await galleryService.getAll();
    if (result.success) {
      setImages(result.data || []);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (newImageUrl.trim()) {
      const result = await galleryService.create({
        url: newImageUrl,
        caption: newCaption || 'New Image'
      });
      
      if (result.success && result.data) {
        setImages([result.data, ...images]);
      }
      
      setNewImageUrl('');
      setNewCaption('');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    const result = await galleryService.delete(id);
    if (result.success) {
      setImages(images.filter(img => img.id !== id));
    } else {
      alert('Failed to delete image');
    }
  };

  if (loading) {
    return <div className="text-white">Loading gallery...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Manage Gallery</h2>

      {/* Add New Image */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Add New Image</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Image URL</label>
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Caption</label>
            <input
              type="text"
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Image caption..."
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <button type="submit" className="px-6 py-2 bg-green-500 text-white rounded-lg">
            Add Image
          </button>
        </form>
      </div>

      {/* Gallery Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {images.length === 0 ? (
          <p className="text-gray-400 col-span-3">No images yet. Add some images to display in the gallery.</p>
        ) : (
          images.map((image) => (
            <div key={image.id} className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
              <div className="aspect-video">
                <img src={image.url} alt={image.caption} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <p className="text-gray-400 text-sm mb-3">{image.caption}</p>
                <button
                  onClick={() => handleDelete(image.id)}
                  className="w-full px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CheckInRow({ name, status, statusColor, location, time }) {
  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
      <td className="py-4 px-4 text-white">{name}</td>
      <td className={`py-4 px-4 font-semibold ${statusColor}`}>{status}</td>
      <td className="py-4 px-4 text-gray-400">{location}</td>
      <td className="py-4 px-4 text-gray-400">{time}</td>
    </tr>
  );
}

// About Us Page
function AboutUsPage() {
  const teamMembers = [
    {
      name: 'Clark Adrian O. Dela Cruz',
      role: 'DATABASE DEVELOPER',
      image: 'https://i.imgur.com/SPc6uhg.png',
      linkedin: 'https://linkedin.com'
    },
    {
      name: 'Aldwin Charles P. Morandarte',
      role: 'BACKEND DEVELOPER',
      image: 'https://i.imgur.com/nKo38A8.png',
      linkedin: 'https://www.linkedin.com/in/aldwin-charles-morandarte-423497369/'
    },
    {
      name: 'Mick Daniel Q. Morales',
      role: 'FULLSTACK DEVELOPER',
      image: 'https://i.imgur.com/VS1lqrO.jpeg',
      linkedin: 'https://www.linkedin.com/in/danielmrlss/'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About Us</h1>
        <p className="text-xl text-cyan-300 mb-4">Meet the Team Behind Tag-Abantay</p>
        <p className="text-gray-400 max-w-2xl mx-auto">
          We are BS Information Technology students from Ateneo de Naga University, 
          dedicated to developing innovative safety solutions for our community.
        </p>
      </div>

      {/* Team Members */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {teamMembers.map((member, index) => (
          <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 text-center hover:border-cyan-500/50 transition-all duration-300">
            {/* Profile Picture */}
            <div className="mb-6">
              <img 
                src={member.image} 
                alt={member.name}
                className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-cyan-500/30"
              />
            </div>
            
            {/* Name */}
            <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
            <p className="text-cyan-400 text-sm mb-6">{member.role}</p>
            
            {/* LinkedIn Button */}
            <a 
              href={member.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              <span>LinkedIn Profile</span>
            </a>
          </div>
        ))}
      </div>

      {/* Project Info */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">About Tag-Abantay</h2>
        <p className="text-gray-400 text-center max-w-3xl mx-auto">
          Tag-Abantay is a typhoon safety monitoring system developed as part of our academic requirements 
          at Ateneo de Naga University. The system provides real-time safety monitoring, evacuation route 
          tracking, and emergency check-in features to help keep the AdNU community safe during typhoon events.
        </p>
      </div>
    </div>
  );
}

// Add animation styles
const styles = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.6s ease-out;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
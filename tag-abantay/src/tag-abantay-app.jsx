import React, { useState, useEffect, useRef } from 'react';

// CLEANUP FIX: Clear only the hanging Supabase locks without logging the user out
if (typeof window !== 'undefined') {
  Object.keys(localStorage).forEach(key => {
    if (key.includes('sb-') && key.includes('auth-token-lock')) {
      localStorage.removeItem(key);
      console.log('CLEANUP: Removed hanging storage lock:', key);
    }
  });
}

import { AlertTriangle, Shield, MapPin, Users, Bell, CloudRain, X, Menu, ChevronRight, Home, Send, Eye, EyeOff, Info, QrCode } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { QRCodeSVG } from 'qrcode.react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from './services/supabaseClient';
import { useAuth } from './hooks/useAuth';
import { useAlerts } from './hooks/useAlerts';
import { useCheckIns } from './hooks/useCheckIns';
import { notificationService } from './services/notificationService';
import { announcementService, galleryService } from './services/bulletinService';
import { checkInService } from './services/checkInService';
import { alertService } from './services/alertService';
import { evacuationService } from './services/evacuationService';

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
  const { user, isAuthenticated, isAdmin, signIn, signUp, sendMagicLink, signOut, loading: authLoading } = useAuth();
  const { currentAlert, alertInfo, isActive } = useAlerts();
  const { safetyStats, submitCheckIn, reloadStats } = useCheckIns(user?.id);

  // Handle URL parameters for QR code registration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page === 'signup' && !isAuthenticated) {
      setCurrentPage('login');
      window.history.replaceState({}, '', window.location.pathname); // Clean URL
      sessionStorage.setItem('auth_mode_hint', 'signup');
    }
  }, [isAuthenticated]);

  // Initialize notifications on mount
  useEffect(() => {
    notificationService.initialize();
    
    // Listen for in-app alerts
    const handleAlert = (event) => {
      console.log('Alert received:', event.detail);
    };
    window.addEventListener('tagabantay-alert', handleAlert);
    
    // Listen for 401 unauthorized events from the client
    const handleUnauthorized = () => {
      console.warn('App: Unauthorized access detected, logging out...');
      handleLogout();
    };
    window.addEventListener('supabase-unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('tagabantay-alert', handleAlert);
      window.removeEventListener('supabase-unauthorized', handleUnauthorized);
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
        {currentPage === 'home' && (
          <HomePage 
            setCurrentPage={setCurrentPage} 
            typhoonAlert={typhoonAlert} 
            isAuthenticated={isAuthenticated}
          />
        )}
        {currentPage === 'alerts' && <AlertsPage typhoonAlert={typhoonAlert} alertInfo={alertInfo} />}
        {currentPage === 'map' && <EvacuationMapPage />}
        {currentPage === 'login' && !isAuthenticated && (
          <LoginPage 
            handleLogin={handleLogin} 
            handleSignUp={signUp}
            setCurrentPage={setCurrentPage} 
          />
        )}
        {currentPage === 'dashboard' && isAuthenticated && (
          isAdmin ? 
            <AdminDashboard safetyStats={safetyStats} /> : 
            <StudentDashboard safetyStats={safetyStats} setCurrentPage={setCurrentPage} />
        )}
        {currentPage === 'checkin' && isAuthenticated && <CheckInPage submitCheckIn={submitCheckIn} user={user} />}
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
                      {user?.email?.toLowerCase().includes('admin') 
                        ? 'Administrator' 
                        : user?.role === 'faculty' 
                          ? 'AdNU Faculty' 
                          : user?.role === 'staff'
                            ? 'AdNU Staff'
                            : 'AdNU Student'}
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

          {/* Alert Banner (Desktop/Tablet) */}
          {typhoonAlert.level > 0 && (
            <div className={`${alertLevel.color} text-white px-4 py-2 mb-0 -mx-4 hidden md:flex items-center justify-center space-x-2 animate-pulse`}>
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">{alertLevel.name} - {typhoonAlert.name}</span>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/98 backdrop-blur-lg pt-24 px-6">
          {/* Mobile Alert Banner (integrated into menu) */}
          {typhoonAlert.level > 0 && (
            <div className={`${alertLevel.color} text-white px-4 py-3 rounded-xl mb-6 flex items-center justify-center space-x-2 animate-pulse shadow-lg`}>
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="font-bold text-sm leading-tight text-center">{alertLevel.name} - {typhoonAlert.name}</span>
            </div>
          )}
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
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white truncate max-w-[200px]">{user?.email}</p>
                      <p className="text-xs text-cyan-400">
                        {user?.email?.toLowerCase().includes('admin') 
                          ? 'System Administrator' 
                          : user?.role === 'faculty' 
                            ? 'AdNU Faculty' 
                            : user?.role === 'staff'
                              ? 'AdNU Staff'
                              : 'AdNU Student'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="w-full px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Logout
                  </button>
                </div>
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

function HomePage({ setCurrentPage, typhoonAlert, isAuthenticated }) {
  const alertLevel = ALERT_LEVELS[typhoonAlert.level];
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
    
    // Poll every 5 seconds for updates (realtime disabled)
    const pollInterval = setInterval(() => {
      loadAnnouncements();
    }, 5000);
    
    return () => {
      clearInterval(pollInterval);
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
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Fallback to raw string if invalid
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) + ' ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return dateString;
    }
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
        <div className={`${alertLevel.color} text-white rounded-2xl p-6 md:p-8 mb-12 shadow-2xl`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center space-x-4">
              <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 shrink-0" />
              <div>
                <h2 className="text-2xl md:text-3xl font-bold leading-tight">{alertLevel.name}</h2>
                <p className="text-base md:text-lg opacity-90">{typhoonAlert.name}</p>
              </div>
            </div>
            <div className="md:text-right border-t border-white/20 pt-4 md:border-0 md:pt-0">
              <p className="text-xs md:text-sm opacity-75 uppercase tracking-wider mb-1">Last Updated</p>
              <p className="font-semibold text-sm md:text-base">{formatDate(typhoonAlert.updated)}</p>
            </div>
          </div>
          <p className="text-sm opacity-90 leading-relaxed">
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
          onClick={() => setCurrentPage(isAuthenticated ? 'checkin' : 'login')}
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
      const newImages = result.data || [];
      setImages(newImages);
      // Reset to 0 to prevent out-of-bounds crash when image list changes
      setCurrentIndex(0);
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

// Map Controller Component to handle programmatic map control
function MapController({ focusTrigger }) {
  const map = useMap();
  
  useEffect(() => {
    if (focusTrigger) {
      map.setView(CAMPUS_LOCATION, 16, {
        animate: true,
        duration: 1
      });
    }
  }, [focusTrigger, map]);
  
  return null;
}

// Map Click Handler Component
function MapClickHandler({ onClick }) {
  const map = useMap();
  
  useEffect(() => {
    const handleClick = (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    };
    
    map.on('click', handleClick);
    
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onClick]);
  
  return null;
}

const campusIcon = L.divIcon({
  className: 'custom-campus-marker',
  html: '<div class="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse"><span class="text-white text-[10px] font-bold">AdNU</span></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const evacuationIcon = L.divIcon({
  className: 'custom-evacuation-marker',
  html: '<div class="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><span class="text-white text-xs">📍</span></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const warningIcon = L.divIcon({
  className: 'custom-warning-marker',
  html: '<div class="w-8 h-8 bg-orange-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce">⚠️</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// AdNU Campus coordinates (Ateneo de Naga University)
const CAMPUS_LOCATION = [13.6268, 123.1848];

// Load warning zones from localStorage
const getWarningZones = () => {
  const stored = localStorage.getItem('tag-abantay-warning-zones');
  return stored ? JSON.parse(stored) : [];
};

const saveWarningZones = (zones) => {
  localStorage.setItem('tag-abantay-warning-zones', JSON.stringify(zones));
};

// Evacuation Map Page
function EvacuationMapPage() {
  const [routes, setRoutes] = useState([]);
  const [warningZones, setWarningZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    loadRoutes();
    loadWarningZones();
    
    // Poll every 3 seconds to detect changes
    const interval = setInterval(() => {
      loadRoutes();
      loadWarningZones();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadRoutes = async () => {
    const result = await evacuationService.getEvacuationRoutes();
    if (result.data) {
      setRoutes(result.data);
    }
    setLoading(false);
  };

  const loadWarningZones = () => {
    const zones = getWarningZones();
    setWarningZones(zones);
  };

  // Generate coordinates for evacuation routes
  const getRouteCoordinates = (route, index) => {
    // If route has saved latitude/longitude from admin map picker, use those
    if (route.latitude && route.longitude) {
      return [route.latitude, route.longitude];
    }
    
    // If route has geojson coordinates, use those
    if (route.geojson?.coordinates) {
      return route.geojson.coordinates;
    }
    
    // Fallback: calculate based on distance
    const distanceKm = parseFloat(route.distance_from_campus_km) || 1;
    const angle = (index * 60) * (Math.PI / 180); // Spread routes in different directions
    const distanceDeg = distanceKm / 111; // Rough conversion: 1 degree ≈ 111 km
    
    const lat = CAMPUS_LOCATION[0] + Math.sin(angle) * distanceDeg;
    const lng = CAMPUS_LOCATION[1] + Math.cos(angle) * distanceDeg;
    return [lat, lng];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Evacuation Map</h1>

      {/* Map Controls */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">Click markers to view details. Use mouse wheel to zoom.</p>
        <button
          onClick={() => setFocusTrigger(prev => prev + 1)}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Focus on Campus
        </button>
      </div>

      {/* Interactive Map */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 mb-8">
        <div className="rounded-xl overflow-hidden" style={{ height: '500px' }}>
          <MapContainer
            center={CAMPUS_LOCATION}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapController focusTrigger={focusTrigger} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Campus Marker with pulsing effect */}
            <Marker position={CAMPUS_LOCATION} icon={campusIcon}>
              <Popup>
                <div className="text-center p-2">
                  <strong className="text-lg text-red-600 block mb-1">Ateneo de Naga University</strong>
                  <p className="text-sm text-gray-600">Main Campus</p>
                  <p className="text-xs text-gray-500 mt-1">Naga City, Camarines Sur</p>
                  <p className="text-xs text-gray-400 mt-2">📍 Central Evacuation Point</p>
                </div>
              </Popup>
            </Marker>
            
            {/* Campus Radius Circle (2km radius) */}
            <Circle
              center={CAMPUS_LOCATION}
              radius={2000}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.1,
                weight: 2
              }}
            />
            
            {/* Evacuation Route Markers */}
            {routes.map((route, index) => {
              const coords = getRouteCoordinates(route, index);
              return (
                <Marker 
                  key={route.id} 
                  position={coords} 
                  icon={evacuationIcon}
                  eventHandlers={{
                    click: () => setSelectedRoute(route)
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-lg mb-1">{route.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{route.description}</p>
                      <div className="space-y-1 text-sm">
                        <p><strong>Capacity:</strong> {route.capacity} persons</p>
                        <p><strong>Distance:</strong> {parseFloat(route.distance_from_campus_km || 0).toFixed(1)} km from campus</p>
                        <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Available</span></p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
                            window.open(url, '_blank');
                          }}
                          className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <MapPin className="w-3 h-3" />
                          Open in Google Maps
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Polylines connecting campus to evacuation routes */}
            {routes.map((route, index) => {
              const coords = getRouteCoordinates(route, index);
              return (
                <Polyline
                  key={route.id}
                  positions={[CAMPUS_LOCATION, coords]}
                  pathOptions={{
                    color: '#10b981',
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '10, 10'
                  }}
                />
              );
            })}
            
            {/* Warning Zones - Areas to Avoid */}
            {warningZones.map((zone) => (
              <React.Fragment key={zone.id}>
                {/* Warning Zone Circle */}
                <Circle
                  center={[zone.latitude, zone.longitude]}
                  radius={zone.radius_meters || 50}
                  pathOptions={{
                    color: '#f97316',
                    fillColor: '#f97316',
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                />
                {/* Warning Marker */}
                <Marker 
                  position={[zone.latitude, zone.longitude]} 
                  icon={warningIcon}
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm">⚠️</div>
                        <h3 className="font-bold text-orange-600">{zone.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{zone.description}</p>
                      <div className="bg-orange-100 border border-orange-300 rounded p-2">
                        <p className="text-xs text-orange-700 font-semibold">⚠️ DANGER ZONE - AVOID THIS AREA</p>
                        <p className="text-xs text-gray-600 mt-1">Radius: {zone.radius_meters || 50} meters</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
        
        {/* Map Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-gray-300">AdNU Campus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-300">Evacuation Center</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span className="text-gray-300">⚠️ Avoid Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-dashed border-green-500"></div>
            <span className="text-gray-300">Evacuation Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-red-500 bg-red-500/10"></div>
            <span className="text-gray-300">2km Safety Radius</span>
          </div>
        </div>
      </div>

      {/* Warning Zones Section */}
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-orange-500">⚠️</span> Areas to Avoid
      </h2>
      {warningZones.length === 0 ? (
        <div className="text-gray-400 mb-8">No warning zones. Admin can add danger areas from the Dashboard.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {warningZones.map((zone) => (
            <div key={zone.id} className="bg-slate-800/50 rounded-2xl p-6 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <span className="text-orange-400 text-lg">⚠️</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">{zone.name}</h3>
                  <p className="text-xs text-orange-400 font-semibold">⚠️ DANGER ZONE - AVOID</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-3">{zone.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Radius: {zone.radius_meters || 50}m
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evacuation Centers List */}
      <h2 className="text-2xl font-bold text-white mb-4">Evacuation Centers</h2>
      {loading ? (
        <div className="text-white">Loading evacuation routes...</div>
      ) : routes.length === 0 ? (
        <div className="text-gray-400">No evacuation routes available. Add routes in the Admin Dashboard.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {routes.map((route) => (
            <EvacuationCenter
              key={route.id}
              name={route.name}
              capacity={`${route.capacity} persons`}
              distance={`${route.distance_from_campus_km} km`}
              status="Available"
            />
          ))}
        </div>
      )}
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
function LoginPage({ handleLogin, handleSignUp, setCurrentPage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userRole, setUserRole] = useState('student');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        const result = await handleSignUp(email, password, { 
          full_name: fullName,
          role: userRole
        });
        if (result.success) {
          setSuccess('Registration successful! Please check your email for a confirmation link before signing in.');
          setFullName('');
          setEmail('');
          setPassword('');
          setUserRole('student');
          // Switch to login after 5 seconds
          setTimeout(() => setIsSignUp(false), 5000);
        } else {
          setError(result.error?.message || 'Sign up failed.');
        }
      } else {
        const result = await handleLogin(email, password);
        if (!result.success) {
          setError(result.error?.message || 'Login failed.');
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 md:py-12 animate-fadeIn">
      <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl">
        <div className="text-center mb-10">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
            <img src="https://i.imgur.com/SPc6uhg.png" alt="AdNU Logo" className="relative w-20 h-20 mx-auto rounded-full object-cover border-2 border-white/10" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
            {isSignUp ? 'Join Tag-Abantay' : 'AdNU Login'}
          </h1>
          <p className="text-slate-400 font-medium">
            {isSignUp 
              ? 'Safety Registration for AdNU' 
              : 'Sign in to your safety portal'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900/50 backdrop-blur-sm rounded-2xl p-1.5 mb-8 border border-white/5">
          <button
            onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${!isSignUp ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${isSignUp ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-shake">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 animate-fadeIn">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-green-400 text-sm font-medium">{success}</p>
              </div>
            </div>
          )}
          
          {isSignUp && (
            <div className="animate-slideDown space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan D. Dela Cruz"
                  className="w-full px-5 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                  required={isSignUp}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  I am a
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['student', 'faculty', 'staff'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setUserRole(role)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
                        userRole === role 
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                          : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
              AdNU Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gbox.adnu.edu.ph"
              className="w-full px-5 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
              Secure Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {isSignUp && (
              <p className="mt-2 text-[10px] text-slate-500 font-medium ml-1">
                MUST BE AT LEAST 6 CHARACTERS
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold rounded-2xl transition-all duration-300 shadow-xl shadow-cyan-500/20 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : (
              isSignUp ? 'Create My Account' : 'Sign Into Portal'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setCurrentPage('home')}
            className="block w-full text-xs font-bold text-slate-500 hover:text-cyan-400 uppercase tracking-widest transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ safetyStats, setCurrentPage }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [latestCheckIn, setLatestCheckIn] = useState(null);
  const [loadingCheckIn, setLoadingCheckIn] = useState(true);
  const { user, updatePassword } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadMyLatestCheckIn();
      // Poll for updates every 10 seconds
      const interval = setInterval(loadMyLatestCheckIn, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadMyLatestCheckIn = async () => {
    try {
      const result = await checkInService.getLatestCheckIn(user.id);
      if (result.data) {
        setLatestCheckIn(result.data);
      }
    } catch (err) {
      console.warn('Failed to load latest check-in:', err);
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'safe') return 'bg-green-500';
    if (s === 'need_help' || s === 'needs_help') return 'bg-red-500';
    if (s === 'unreachable') return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const getStatusText = (status) => {
    const s = status?.toLowerCase();
    if (s === 'safe') return 'Safe';
    if (s === 'need_help' || s === 'needs_help') return 'Needs Help';
    if (s === 'unreachable') return 'Unreachable';
    return status || 'Unknown';
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setUpdating(true);
    const result = await updatePassword(newPassword);
    if (result.success) {
      setPasswordSet(true);
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError('Failed to set password: ' + (result.error?.message || 'Unknown error'));
    }
    setUpdating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Mobile User Profile Header */}
      <div className="md:hidden flex items-center space-x-3 mb-6 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
        <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-inner">
          <Users className="w-6 h-6 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Logged in as</p>
          <p className="text-sm font-bold text-white truncate">{user?.email}</p>
          <p className="text-xs text-cyan-400 font-medium">
            {user?.role === 'faculty' ? 'AdNU Faculty' : user?.role === 'staff' ? 'AdNU Staff' : 'AdNU Student'}
          </p>
        </div>
      </div>

      <h1 className="text-4xl font-bold text-white mb-8">Student Dashboard</h1>

      {/* Set Password Banner - only shown if not yet set */}
      {!passwordSet && !showPasswordForm && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 font-semibold">Set a Password</p>
              <p className="text-gray-300 text-sm">Set a password so you can log in without a magic link</p>
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

      {/* Password Set Success Banner */}
      {passwordSet && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6">
          <p className="text-green-400 font-semibold">✓ Password set successfully! You can now log in with email and password.</p>
        </div>
      )}

      {/* Password Form */}
      {showPasswordForm && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Set Your Password</h3>
          {passwordError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{passwordError}</p>
            </div>
          )}
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">New Password (min 6 characters)</label>
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                required
                minLength={6}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updating}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Save Password'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPasswordError(''); }}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
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
          <QuickActionButton icon={Shield} onClick={() => setCurrentPage('checkin')}>Submit Check-In</QuickActionButton>
          <QuickActionButton icon={MapPin} onClick={() => setCurrentPage('map')}>View Evacuation Routes</QuickActionButton>
          <QuickActionButton icon={Bell} onClick={() => setCurrentPage('alerts')}>View Alerts</QuickActionButton>
          <QuickActionButton icon={Send} onClick={() => setCurrentPage('checkin')}>Report Incident</QuickActionButton>
        </div>
      </div>

      {/* My Status */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">My Safety Status</h2>
          <button 
            onClick={() => setCurrentPage('checkin')}
            className="text-sm text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            Update Status <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {loadingCheckIn ? (
          <p className="text-gray-400 animate-pulse">Loading your status...</p>
        ) : latestCheckIn ? (
          <div className="flex flex-col md:flex-row md:items-center gap-6 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
            <div className={`w-16 h-16 rounded-2xl ${getStatusColor(latestCheckIn.status)} flex items-center justify-center shadow-lg`}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-lg">{getStatusText(latestCheckIn.status)}</span>
                <span className="px-3 py-0.5 bg-white/10 rounded-full text-[10px] text-gray-400 uppercase tracking-tighter font-bold">Latest Update</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-4 h-4 text-cyan-500/70" />
                  <span>{latestCheckIn.location || 'Location not specified'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Bell className="w-4 h-4 text-cyan-500/70" />
                  <span>{formatTime(latestCheckIn.created_at)}</span>
                </div>
                {latestCheckIn.notes && (
                  <div className="col-span-full mt-2 p-3 bg-white/5 rounded-lg border border-white/5 italic text-gray-300">
                    "{latestCheckIn.notes}"
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">You haven't submitted a safety status yet.</p>
            <button 
              onClick={() => setCurrentPage('checkin')}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
            >
              Check-In Now
            </button>
          </div>
        )}
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

function QuickActionButton({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200"
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{children}</span>
    </button>
  );
}

// Check-In Page
function CheckInPage({ submitCheckIn, user }) {
  const [status, setStatus] = useState('safe');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    
    const result = await submitCheckIn({
      userId: user?.id,
      status,
      location,
      notes
    });
    
    if (result.success) {
      setFeedback({ type: 'success', message: 'Check-in submitted successfully!' });
      // Reset form
      setStatus('safe');
      setLocation('');
      setNotes('');
    } else {
      setFeedback({ type: 'error', message: `Failed to submit check-in: ${result.error || 'Please try again.'}` });
    }
    
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-8">Safety Check-In</h1>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
        {feedback && (
          <div className={`mb-6 rounded-lg p-4 ${feedback.type === 'success' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
            <p className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{feedback.message}</p>
          </div>
        )}
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
                selected={status === 'need_help'}
                onClick={() => setStatus('need_help')}
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
            disabled={submitting}
            className="w-full px-6 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/30"
          >
            {submitting ? 'Submitting...' : 'Submit Check-In'}
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [checkIns, setCheckIns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(false); // ALWAYS FALSE
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [safetyStats, setSafetyStats] = useState(initialStats || { safe: 0, needsHelp: 0, unreachable: 0, notReported: 0 });
  
  // Pagination & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPageNum] = useState(1);
  const itemsPerPage = 10;

  // Master Data Loader
  useEffect(() => {
    const loadAllData = async () => {
      // Don't set loading to true anymore
      try {
        if (activeTab === 'overview') {
          loadCheckIns(false);
          loadSafetyStats();
        } else if (activeTab === 'alerts') {
          const res = await alertService.getAllAlerts();
          setAlerts(res.data || []);
        } else if (activeTab === 'announcements') {
          const res = await announcementService.getAll();
          setAnnouncements(res.data || []);
        } else if (activeTab === 'maps') {
          const res = await evacuationService.getEvacuationRoutes();
          setRoutes(res.data || []);
        } else if (activeTab === 'gallery') {
          const res = await galleryService.getAll();
          setGalleryImages(res.data || []);
        }
      } catch (err) {
        console.warn(`AdminDashboard: Silent load failure:`, err.message);
      }
    };

    loadAllData();
  }, [activeTab]);

  const loadCheckIns = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await checkInService.getAllCheckIns(50);
      if (result.data) setCheckIns(result.data);
    } catch (err) {
      console.error('Error loading check-ins:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadSafetyStats = async () => {
    try {
      const result = await checkInService.getSafetyStats();
      if (result.data) {
        setSafetyStats({
          safe: result.data.safe || 0,
          needsHelp: result.data.need_help || 0,
          unreachable: result.data.unreachable || 0,
          notReported: result.data.not_reported || 0
        });
      }
    } catch (err) {
      console.error('Error loading safety stats:', err);
    }
  };

  // Poll for stats updates
  useEffect(() => {
    if (activeTab === 'overview') {
      const interval = setInterval(() => {
        loadSafetyStats();
        loadCheckIns(false);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

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
      {/* Mobile User Profile Header */}
      <div className="md:hidden flex items-center space-x-3 mb-6 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
        <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-inner">
          <Shield className="w-6 h-6 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Logged in as</p>
          <p className="text-sm font-bold text-white truncate">{user?.email}</p>
          <p className="text-xs text-cyan-400 font-medium text-uppercase tracking-wider">System Administrator</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
        <button className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-all duration-200">
          Broadcast Alert
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-8 bg-slate-800/50 p-2 rounded-xl flex-wrap">
        <AdminTab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={Shield}>
          Overview
        </AdminTab>
        <AdminTab active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} icon={AlertTriangle}>
          Alerts
        </AdminTab>
        <AdminTab active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} icon={Bell}>
          Announcements
        </AdminTab>
        <AdminTab active={activeTab === 'maps'} onClick={() => setActiveTab('maps')} icon={MapPin}>
          Evacuation
        </AdminTab>
        <AdminTab active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={Info}>
          Gallery
        </AdminTab>
        <AdminTab active={activeTab === 'registration'} onClick={() => setActiveTab('registration')} icon={QrCode}>
          Student QR
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-white">Recent Check-Ins</h2>
              
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPageNum(1); // Reset to page 1 on search
                  }}
                  className="w-full md:w-64 px-10 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
                />
                <Users className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <p className="text-gray-400">Loading check-ins...</p>
              ) : checkIns.length === 0 ? (
                <p className="text-gray-400">No check-ins yet. Data will appear here when students submit their status.</p>
              ) : (
                <>
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
                      {checkIns
                        .filter(ci => {
                          const name = (ci.users?.full_name || ci.users?.email || '').toLowerCase();
                          return name.includes(searchTerm.toLowerCase());
                        })
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((checkIn, index) => (
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

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-700">
                    <p className="text-sm text-gray-500">
                      Showing {Math.min(checkIns.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(checkIns.length, currentPage * itemsPerPage)} of {checkIns.length} check-ins
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPageNum(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPageNum(prev => Math.min(Math.ceil(checkIns.length / itemsPerPage), prev + 1))}
                        disabled={currentPage >= Math.ceil(checkIns.length / itemsPerPage)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'alerts' && <AdminAlerts />}
      {activeTab === 'announcements' && <AdminAnnouncements />}
      {activeTab === 'maps' && <AdminEvacuation />}
      {activeTab === 'gallery' && <AdminGallery />}
      {activeTab === 'registration' && <AdminRegistrationQR />}
    </div>
  );
}

// Admin Student Registration QR Component
function AdminRegistrationQR() {
  const [appUrl, setAppUrl] = useState(window.location.origin);
  const registrationUrl = `${appUrl}?page=signup`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Student Registration QR Code</h3>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">
          Display this QR code around campus. Students can scan it to officially register for Tag-Abantay with their @gbox.adnu.edu.ph email.
        </p>

        <div className="bg-white p-6 rounded-2xl inline-block mb-8 shadow-2xl shadow-cyan-500/20 border-4 border-cyan-500">
          <QRCodeSVG 
            value={registrationUrl} 
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-cyan-400 font-mono break-all bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 inline-block px-6">
            {registrationUrl}
          </p>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20"
            >
              <QrCode className="w-5 h-5" />
              Print QR Code
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(registrationUrl);
                alert('Registration link copied to clipboard!');
              }}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Security Features
          </h4>
          <ul className="text-sm text-gray-400 space-y-3">
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              Only @gbox.adnu.edu.ph emails are allowed.
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              Email verification is required before access.
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              Automatic student role assignment.
            </li>
          </ul>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-cyan-400" />
            Instructions
          </h4>
          <p className="text-sm text-gray-400 leading-relaxed">
            1. Print the QR code and place it at AdNU entrances or bulletin boards.<br/>
            2. Students scan it and are redirected to the registration page.<br/>
            3. Once they verify their email, they can start using Tag-Abantay.
          </p>
        </div>
      </div>
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
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [formError, setFormError] = useState('');

  // Fetch announcements on mount
  useEffect(() => {
    loadAnnouncements();
    
    // Poll every 5 seconds for updates (realtime disabled)
    const pollInterval = setInterval(() => {
      loadAnnouncements();
    }, 5000);
    
    return () => {
      clearInterval(pollInterval);
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
    setFormError('');
  };

  const handleEdit = (announcement) => {
    setIsEditing(true);
    setEditingId(announcement.id);
    setFormData({ title: announcement.title, content: announcement.content });
    setFormError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    const result = await announcementService.delete(id);
    if (result.success) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } else {
      alert('Failed to delete announcement: ' + (result.error?.message || 'Unknown error'));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    
    if (editingId) {
      const result = await announcementService.update(editingId, formData);
      if (result.success) {
        // Use returned data if available, else merge locally
        setAnnouncements(prev => prev.map(a => 
          a.id === editingId 
            ? (result.data || { ...a, ...formData, updated_at: new Date().toISOString() })
            : a
        ));
        setIsEditing(false);
        setFormData({ title: '', content: '' });
      } else {
        setFormError('Failed to save: ' + (result.error?.message || 'Unknown error'));
      }
    } else {
      const result = await announcementService.create(formData);
      if (result.success && result.data) {
        setAnnouncements(prev => [result.data, ...prev]);
        setIsEditing(false);
        setFormData({ title: '', content: '' });
      } else {
        setFormError('Failed to create: ' + (result.error?.message || 'Unknown error'));
      }
    }
    
    setSaving(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Fallback to raw string if invalid
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) + ' ' + date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return dateString;
    }
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
          {formError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{formError}</p>
            </div>
          )}
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
              <button type="submit" disabled={saving} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white rounded-lg transition-all">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setFormError(''); }}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
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
  const [saving, setSaving] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name, file.size, file.type);

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setGalleryError('File size exceeds 5MB limit');
      return;
    }

    setSelectedFile(file);
    setNewImageUrl('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('FileReader complete, base64 length:', reader.result.length);
      setPreviewUrl(reader.result);
    };
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      setGalleryError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newImageUrl.trim() && !selectedFile) return;
    setSaving(true);
    setGalleryError('');

    let fileData = null;
    
    // If file selected, convert to base64
    if (selectedFile) {
      fileData = previewUrl;
    }

    const result = await galleryService.create({
      url: newImageUrl.trim(),
      caption: newCaption.trim() || 'New Image',
      fileData
    });
    
    if (result.success && result.data) {
      // Reload from localStorage to ensure sync
      await loadImages();
      setNewImageUrl('');
      setNewCaption('');
      setSelectedFile(null);
      setPreviewUrl('');
    } else {
      setGalleryError('Failed to add image: ' + (result.error?.message || 'Unknown error'));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    const result = await galleryService.delete(id);
    if (result.success) {
      setImages(prev => prev.filter(img => img.id !== id));
    } else {
      alert('Failed to delete image: ' + (result.error?.message || 'Unknown error'));
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
        {galleryError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{galleryError}</p>
          </div>
        )}
        <form onSubmit={handleAdd} className="space-y-4">
          {/* File Upload Option */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Upload from Computer</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-400"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum file size: 5MB</p>
          </div>
          
          {/* Preview */}
          {previewUrl && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Preview:</p>
              <img src={previewUrl} alt="Preview" className="max-w-xs max-h-48 rounded-lg object-cover" />
            </div>
          )}
          
          {/* OR Divider */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 h-px bg-slate-700"></div>
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>
          
          {/* URL Option */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Image URL</label>
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
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
          
          <button 
            type="submit" 
            disabled={saving || (!newImageUrl.trim() && !selectedFile)} 
            className="px-6 py-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white rounded-lg transition-all"
          >
            {saving ? 'Adding...' : 'Add Image'}
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

// Admin Alerts Component
function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    typhoon_name: '',
    signal_level: 1,
    description: '',
    location: 'Naga City, Camarines Sur'
  });
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let channel = null;
    let pollInterval = null;
    
    const setup = async () => {
      await loadAlerts();
      
      // Subscribe to real-time alert updates
      channel = alertService.subscribeToAlerts((payload) => {
        if (payload.eventType === 'INSERT') {
          setAlerts(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        } else if (payload.eventType === 'DELETE') {
          setAlerts(prev => prev.filter(a => a.id !== payload.old.id));
        }
      });
      
      // Fallback: Poll every 5 seconds if realtime fails
      if (!channel) {
        pollInterval = setInterval(() => {
          loadAlerts();
        }, 5000);
      }
    };
    
    setup();
    
    return () => {
      if (channel) {
        alertService.unsubscribeFromAlerts(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const loadAlerts = async () => {
    const result = await alertService.getAllAlerts();
    if (result.data) {
      setAlerts(result.data);
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const result = await alertService.createAlert(formData);
    
    if (result.data) {
      // SUCCESS: Alert created. 
      // We DO NOT call setAlerts(prev => [result.data, ...prev]) here anymore
      // because the realtime listener (line 2412) will automatically add it 
      // when it detects the database change.
      
      setFormData({
        typhoon_name: '',
        signal_level: 1,
        description: '',
        location: 'Naga City, Camarines Sur'
      });
      setSuccessMessage('Alert broadcasted successfully!');
    } else {
      setFormError('Failed to create alert');
    }
    setSaving(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const result = await alertService.updateAlert(editingId, formData);
    
    if (result.data) {
      setAlerts(prev => prev.map(a => a.id === editingId ? result.data : a));
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        typhoon_name: '',
        signal_level: 1,
        description: '',
        location: 'Naga City, Camarines Sur'
      });
    } else {
      setFormError('Failed to update alert');
    }
    setSaving(false);
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Are you sure you want to deactivate this alert?')) return;
    
    setSuccessMessage('');
    setFormError('');
    
    const result = await alertService.deactivateAlert(id);
    if (result.data || result.error === null) {
      // Update local state
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: false } : a));
      setSuccessMessage('Alert deactivated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      // Force reload from server to ensure sync
      setTimeout(() => loadAlerts(), 1000);
    } else {
      setFormError('Failed to deactivate alert');
    }
  };

  const handleReactivate = async (id) => {
    if (!confirm('Reactivating this alert will deactivate all other active alerts. Continue?')) return;
    
    setSuccessMessage('');
    setFormError('');
    
    const result = await alertService.reactivateAlert(id);
    if (result.data || result.error === null) {
      setSuccessMessage('Alert reactivated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAlerts();
    } else {
      setFormError('Failed to reactivate alert');
    }
  };

  const handleDeleteAlert = async (id) => {
    if (!confirm('Are you sure you want to delete this alert? This cannot be undone.')) return;
    
    setSuccessMessage('');
    setFormError('');
    
    const result = await alertService.deleteAlert(id);
    if (result.success || result.error === null) {
      setSuccessMessage('Alert deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAlerts();
    } else {
      setFormError('Failed to delete alert');
    }
  };

  const handleEdit = (alert) => {
    setIsEditing(true);
    setEditingId(alert.id);
    setFormData({
      typhoon_name: alert.typhoon_name || '',
      signal_level: alert.signal_level || 1,
      description: alert.description || '',
      location: alert.location || 'Naga City, Camarines Sur'
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      typhoon_name: '',
      signal_level: 1,
      description: '',
      location: 'Naga City, Camarines Sur'
    });
    setFormError('');
  };

  const getSignalColor = (level) => {
    const colors = {
      1: 'bg-yellow-500',
      2: 'bg-orange-500',
      3: 'bg-red-500',
      4: 'bg-red-700',
      5: 'bg-red-900'
    };
    return colors[level] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="text-white">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alert Form */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isEditing ? 'Edit Alert' : 'Broadcast New Alert'}
        </h3>
        {formError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{formError}</p>
          </div>
        )}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-4">
            <p className="text-green-400 text-sm">{successMessage}</p>
          </div>
        )}
        <form onSubmit={isEditing ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Typhoon Name</label>
              <input
                type="text"
                value={formData.typhoon_name}
                onChange={(e) => setFormData({ ...formData, typhoon_name: e.target.value })}
                placeholder="e.g., Typhoon Ambo"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Signal Level</label>
              <select
                value={formData.signal_level}
                onChange={(e) => setFormData({ ...formData, signal_level: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value={1}>Signal No. 1 (Yellow)</option>
                <option value={2}>Signal No. 2 (Orange)</option>
                <option value={3}>Signal No. 3 (Red)</option>
                <option value={4}>Signal No. 4 (Dark Red)</option>
                <option value={5}>Signal No. 5 (Maroon)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter alert details and safety instructions..."
              rows="3"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Naga City, Camarines Sur"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              required
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white rounded-lg transition-all"
            >
              {saving ? 'Saving...' : (isEditing ? 'Update Alert' : 'Broadcast Alert')}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Alerts List */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Alert History</h3>
        {alerts.length === 0 ? (
          <p className="text-gray-400">No alerts yet.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              console.log('Rendering alert:', alert.id, 'is_active:', alert.is_active, 'type:', typeof alert.is_active);
              return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${!!alert.is_active ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-700 bg-slate-800/30'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${getSignalColor(alert.signal_level)}`}>
                        Signal {alert.signal_level}
                      </span>
                      {!!alert.is_active && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <h4 className="text-white font-semibold">{alert.typhoon_name}</h4>
                    <p className="text-gray-400 text-sm mt-1">{alert.description}</p>
                    <p className="text-gray-500 text-xs mt-2">{alert.location}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(alert)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded hover:bg-blue-500/30 transition-all"
                    >
                      Edit
                    </button>
                    {!!alert.is_active ? (
                      <button
                        onClick={() => handleDeactivate(alert.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-all"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(alert.id)}
                        className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded hover:bg-green-500/30 transition-all"
                      >
                        Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded hover:bg-gray-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}

// Admin Evacuation Routes Component
function AdminEvacuation() {
  const [routes, setRoutes] = useState([]);
  const [warningZones, setWarningZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' or 'warnings'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacity: '',
    distance_from_campus_km: '',
    latitude: null,
    longitude: null
  });
  const [warningFormData, setWarningFormData] = useState({
    name: '',
    description: '',
    latitude: null,
    longitude: null,
    radius_meters: 50
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let channel = null;
    let pollInterval = null;
    
    const setup = async () => {
      await loadRoutes();
      
      // Load warning zones from localStorage
      const zones = getWarningZones();
      setWarningZones(zones);
      
      // Subscribe to real-time evacuation route updates
      channel = evacuationService.subscribeToRoutes((payload) => {
        if (payload.eventType === 'INSERT') {
          setRoutes(prev => (prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]));
        } else if (payload.eventType === 'UPDATE') {
          setRoutes(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        } else if (payload.eventType === 'DELETE') {
          setRoutes(prev => prev.filter(r => r.id !== payload.old.id));
        }
      });
      
      // Fallback: Poll every 5 seconds if realtime fails
      if (!channel) {
        pollInterval = setInterval(() => {
          loadRoutes();
        }, 5000);
      }
    };
    
    setup();
    
    return () => {
      if (channel) {
        evacuationService.unsubscribeFromRoutes(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const loadRoutes = async () => {
    const result = await evacuationService.getEvacuationRoutes();
    if (result.data) {
      setRoutes(result.data);
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    if (!formData.latitude || !formData.longitude) {
      setFormError('Please click on the map to set the evacuation center location');
      setSaving(false);
      return;
    }

    const result = await evacuationService.createEvacuationRoute({
      ...formData,
      capacity: parseInt(formData.capacity) || 0,
      distance_from_campus_km: parseFloat(formData.distance_from_campus_km) || 0,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude)
    });
    
    if (result.data) {
      setRoutes(prev => (prev.some(r => r.id === result.data.id) ? prev : [...prev, result.data]));
      setFormData({
        name: '',
        description: '',
        capacity: '',
        distance_from_campus_km: '',
        latitude: null,
        longitude: null
      });
    } else {
      setFormError('Failed to create route');
    }
    setSaving(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    const result = await evacuationService.updateEvacuationRoute(editingId, {
      ...formData,
      capacity: parseInt(formData.capacity) || 0,
      distance_from_campus_km: parseFloat(formData.distance_from_campus_km) || 0,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude)
    });
    
    if (result.data) {
      setRoutes(prev => prev.map(r => r.id === editingId ? result.data : r));
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        capacity: '',
        distance_from_campus_km: '',
        latitude: null,
        longitude: null
      });
    } else {
      setFormError('Failed to update route');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this evacuation route?')) return;
    
    const result = await evacuationService.deleteEvacuationRoute(id);
    if (result.error === null) {
      setRoutes(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleEdit = (route) => {
    setIsEditing(true);
    setEditingId(route.id);
    setFormData({
      name: route.name || '',
      description: route.description || '',
      capacity: route.capacity?.toString() || '',
      distance_from_campus_km: route.distance_from_campus_km?.toString() || '',
      latitude: route.latitude || null,
      longitude: route.longitude || null
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      capacity: '',
      distance_from_campus_km: '',
      latitude: null,
      longitude: null
    });
    setFormError('');
  };

  if (loading) {
    return <div className="text-white">Loading evacuation routes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Route Form */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isEditing ? 'Edit Evacuation Route' : 'Add Evacuation Route'}
        </h3>
        {formError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{formError}</p>
          </div>
        )}
        <form onSubmit={isEditing ? handleUpdate : handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Route Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., AdNU Main Building"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter route details and directions..."
              rows="2"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Capacity</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="e.g., 500"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Distance from Campus: <span className="text-cyan-400">{formData.distance_from_campus_km || 0} km</span>
              </label>
              <p className="text-xs text-gray-500">Auto-calculated from map location</p>
            </div>
          </div>
          
          {/* Map Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Click on the map to set location
            </label>
            <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: '300px' }}>
              <MapContainer
                center={CAMPUS_LOCATION}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Campus Marker (red) */}
                <Marker position={CAMPUS_LOCATION} icon={campusIcon}>
                  <Popup>
                    <div className="text-center p-2">
                      <strong className="text-lg text-red-600">AdNU Campus</strong>
                      <p className="text-xs text-gray-500">Central Point</p>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Selected Location Marker (green) */}
                {formData.latitude && formData.longitude && (
                  <Marker 
                    position={[formData.latitude, formData.longitude]} 
                    icon={evacuationIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        const distance = calculateDistance(CAMPUS_LOCATION[0], CAMPUS_LOCATION[1], lat, lng);
                        setFormData({ 
                          ...formData, 
                          latitude: lat, 
                          longitude: lng,
                          distance_from_campus_km: distance.toFixed(2)
                        });
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <strong>Evacuation Center Location</strong>
                        <p className="text-xs text-gray-500">Drag to adjust</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Click handler to place marker */}
                <MapClickHandler 
                  onClick={(lat, lng) => {
                    const distance = calculateDistance(CAMPUS_LOCATION[0], CAMPUS_LOCATION[1], lat, lng);
                    setFormData({ 
                      ...formData, 
                      latitude: lat, 
                      longitude: lng,
                      distance_from_campus_km: distance.toFixed(2)
                    });
                  }}
                />
              </MapContainer>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={saving}
            className="w-full px-6 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Route' : 'Add Evacuation Route'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full mt-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
            >
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      {/* Routes List */}
      <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
        <h3 className="text-xl font-bold text-white mb-6">Active Evacuation Routes</h3>
        
        {routes.length === 0 ? (
          <p className="text-gray-500">No evacuation routes configured.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {routes.map((route) => (
              <div key={route.id} className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 group hover:border-cyan-500/50 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-white">{route.name}</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(route)}
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded hover:bg-blue-500/30 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-3">{route.description}</p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Capacity: {route.capacity || 'N/A'}</span>
                  <span>Distance: {route.distance_from_campus_km} km</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning Zones Section */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-orange-500/30">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-lg font-semibold text-white">Warning Zones (Areas to Avoid)</h3>
        </div>
        
        {/* Add Warning Zone Form */}
        <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-700/50">
          <h4 className="text-sm font-medium text-orange-400 mb-4">Add Danger Zone</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Zone Name</label>
              <input
                type="text"
                value={warningFormData.name}
                onChange={(e) => setWarningFormData({ ...warningFormData, name: e.target.value })}
                placeholder="e.g., Flooded Area - Bagumbayan Street"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={warningFormData.description}
                onChange={(e) => setWarningFormData({ ...warningFormData, description: e.target.value })}
                placeholder="Why is this area dangerous? e.g., Road is flooded and impassable..."
                rows="2"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Danger Radius (meters)</label>
                <input
                  type="number"
                  value={warningFormData.radius_meters}
                  onChange={(e) => setWarningFormData({ ...warningFormData, radius_meters: parseInt(e.target.value) || 50 })}
                  placeholder="e.g., 50"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Distance around the danger point to mark as unsafe</p>
              </div>
            </div>
            
            {/* Warning Zone Map Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Click on the map to mark danger location
              </label>
              <div className="rounded-xl overflow-hidden border border-orange-500/30" style={{ height: '300px' }}>
                <MapContainer
                  center={CAMPUS_LOCATION}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Campus Marker */}
                  <Marker position={CAMPUS_LOCATION} icon={campusIcon}>
                    <Popup>
                      <div className="text-center p-2">
                        <strong className="text-lg text-red-600">AdNU Campus</strong>
                        <p className="text-xs text-gray-500">Reference Point</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Warning Zone Marker */}
                  {warningFormData.latitude && warningFormData.longitude && (
                    <Marker 
                      position={[warningFormData.latitude, warningFormData.longitude]} 
                      icon={warningIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          setWarningFormData({ 
                            ...warningFormData, 
                            latitude: lat, 
                            longitude: lng
                          });
                        }
                      }}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong className="text-orange-600">⚠️ Danger Zone</strong>
                          <p className="text-xs text-gray-500">Drag to adjust</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* Warning Zone Circle Preview */}
                  {warningFormData.latitude && warningFormData.longitude && (
                    <Circle
                      center={[warningFormData.latitude, warningFormData.longitude]}
                      radius={warningFormData.radius_meters || 50}
                      pathOptions={{
                        color: '#f97316',
                        fillColor: '#f97316',
                        fillOpacity: 0.3,
                        weight: 2
                      }}
                    />
                  )}
                  
                  {/* Click handler */}
                  <MapClickHandler 
                    onClick={(lat, lng) => {
                      // Auto-calculate radius based on distance from campus
                      const distance = calculateDistance(CAMPUS_LOCATION[0], CAMPUS_LOCATION[1], lat, lng);
                      let autoRadius = 50; // default
                      if (distance < 0.3) {
                        autoRadius = 30; // On campus - smaller radius
                      } else if (distance < 0.8) {
                        autoRadius = 50; // Near campus
                      } else if (distance < 2) {
                        autoRadius = 75; // Medium distance
                      } else {
                        autoRadius = 100; // Far from campus
                      }
                      setWarningFormData({ 
                        ...warningFormData, 
                        latitude: lat, 
                        longitude: lng,
                        radius_meters: autoRadius
                      });
                    }}
                  />
                </MapContainer>
              </div>
              <p className="text-xs text-orange-400/70 mt-2">
                ⚠️ Tip: Click where the danger is. Students will see this as an area to avoid.
              </p>
            </div>
            
            <button
              onClick={() => {
                if (!warningFormData.name || !warningFormData.latitude || !warningFormData.longitude) {
                  alert('Please fill in the name and click on the map to set the danger location');
                  return;
                }
                const newZone = {
                  id: 'warning-' + Date.now(),
                  name: warningFormData.name,
                  description: warningFormData.description,
                  latitude: warningFormData.latitude,
                  longitude: warningFormData.longitude,
                  radius_meters: warningFormData.radius_meters || 50,
                  created_at: new Date().toISOString()
                };
                const updated = [...warningZones, newZone];
                setWarningZones(updated);
                saveWarningZones(updated);
                setWarningFormData({
                  name: '',
                  description: '',
                  latitude: null,
                  longitude: null,
                  radius_meters: 50
                });
              }}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-all"
            >
              ⚠️ Add Warning Zone
            </button>
          </div>
        </div>
        
        {/* Warning Zones List */}
        <h4 className="text-sm font-medium text-gray-300 mb-4">Active Warning Zones</h4>
        {warningZones.length === 0 ? (
          <p className="text-gray-500">No warning zones set. Add danger areas above.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {warningZones.map((zone) => (
              <div
                key={zone.id}
                className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <h4 className="text-white font-semibold">{zone.name}</h4>
                  </div>
                  <button
                    onClick={() => {
                      const updated = warningZones.filter(z => z.id !== zone.id);
                      setWarningZones(updated);
                      saveWarningZones(updated);
                    }}
                    className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30 transition-all"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-orange-200/70 text-sm mb-2">{zone.description}</p>
                <div className="text-xs text-orange-400/60">
                  Radius: {zone.radius_meters || 50}m | Set: {new Date(zone.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
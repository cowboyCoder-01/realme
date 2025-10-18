import React, { useState, useEffect, type JSX } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Send, Plus, LogOut, Settings, Users, MessageCircle, X, Copy, Check, UserPlus, Trash2 } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  created_at?: string;
}

interface NewDMModalProps {
  onClose: () => void;
  profile: Profile;
  onDMStarted: (user: Profile) => void;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  invite_code?: string;
  creator_id: string;
}

interface DirectMessage {
  id: string;
  user: {
    id: string;
    user_id: string;
    display_name?: string;
  };
}

type ChatType = 'group' | 'dm';

interface ChatData {
  type: ChatType;
  data: Group | DirectMessage['user'];
}

interface ProfileSetupProps {
  userId: string;
  onComplete: (profile: Profile) => void;
}

interface MessageData {
  content: string;
  sender_id: string;
  group_id?: string;
  recipient_id?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender: {
    id: string;
    display_name?: string;
    user_id: string;
  };
}

interface Invite {
  id: string;
  group_id: string;
  invited_by: string;
  invited_user_id: string;
  groups: Group;
  created_at: string;
  invited_by_profile: Profile;
}

interface CreateGroupModalProps {
  onClose: () => void;
  profile: Profile;
  onCreated: () => void;
}

interface JoinGroupModalProps {
  onClose: () => void;
  profile: Profile;
  onJoined: () => void;
}

interface InviteModalProps {
  group: Group;
  profile: Profile;
  onClose: () => void;
}

interface MembersModalProps {
  group: Group;
  profile: Profile;
  isCreator: boolean;
  onClose: () => void;
}

interface ChatViewProps {
  chat: ChatData;
  profile: Profile;
}

interface InvitesListProps {
  invites: Invite[];
  profile: Profile;
  onUpdate: () => void;
}

interface Member {
  group_id: string;
  user_id: string;
  profiles: Profile;
}

interface SettingsModalProps {
  profile: Profile;
  onClose: () => void;
  onUpdate: (profile: Profile) => void;
}

interface MainAppProps {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

let supabase: SupabaseClient;
try {
  supabase = createClient(supabaseUrl || '', supabaseKey || '');
} catch (err) {
  console.error('Error initializing Supabase client:', err);
  throw new Error('Failed to initialize Supabase client');
}

// Main App Component
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        if (session) {
          await loadProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error loading session:', err);
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session);
      
      // Always update session state first
      setSession(session);

      // Clear error state on auth change
      setError(null);
      
      try {
        if (!session) {
          console.log('No session, clearing profile and state');
          setProfile(null);
          setLoading(false);
          return;
        }

        // Handle sign out event explicitly
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing state');
          setProfile(null);
          setLoading(false);
          return;
        }

        // Only proceed with profile loading for sign in or initial session
        if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') {
          console.log('Ignoring auth event:', event);
          return;
        }

        console.log('Loading profile for user:', session.user.id);
        setLoading(true);

        // Attempt to load profile
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          // Don't throw on not found error, we'll create the profile
          if (error.code !== 'PGRST116') {
            throw error;
          }
        }

        if (profileData) {
          console.log('Found existing profile:', profileData);
          setProfile(profileData);
          setLoading(false);
          return;
        }

        // Create new profile if none exists
        console.log('No profile found, creating one...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: session.user.id,
            user_id: session.user.id,
            display_name: null,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        if (!newProfile) {
          throw new Error('Failed to create user profile');
        }

        console.log('Created new profile:', newProfile);
        setProfile(newProfile);
      } catch (err) {
        console.error('Error in auth state change:', err);
        setError(err instanceof Error ? err.message : 'Failed to handle auth change');
        setProfile(null); // Clear profile on error
      } finally {
        setLoading(false); // Always ensure loading state is cleared
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    if (!userId) {
      console.error('Invalid userId provided to loadProfile:', userId);
      setLoading(false);
      setError('Invalid user ID');
      return;
    }

    console.log('Loading profile for userId:', userId);
    try {
      // First try to find by id
      let { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile lookup by id result:', { data: profileData, error });

      if (!profileData && !error) {
        // If no profile found by id, try with user_id field
        const response = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        console.log('Profile lookup by user_id result:', response);
        profileData = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Database error while loading profile:', error);
        setError(error.message);
        setLoading(false);
        setProfile(null);
        return;
      }

      if (!profileData) {
        console.log('No profile found, will create one...');
        try {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{ 
              id: userId, 
              user_id: userId,
              display_name: null, // Will be set during profile setup
              created_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (createError) throw createError;
          if (!newProfile) throw new Error('Failed to create profile');

          console.log('Created new profile:', newProfile);
          setProfile(newProfile);
        } catch (createErr) {
          console.error('Error creating profile:', createErr);
          setError(createErr instanceof Error ? createErr.message : 'Failed to create profile');
          setProfile(null);
        }
      } else {
        console.log('Found existing profile:', profileData);
        setProfile(profileData);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setLoading(false);
    }
  };

  if (loading || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 flex flex-col items-center space-y-4">
          {loading ? (
            <>
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <div className="text-white text-xl font-medium">Loading...</div>
            </>
          ) : error ? (
            <>
              <div className="text-white text-xl font-medium">Error</div>
              <div className="text-white/80 text-center">{error}</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-white/90 transition"
              >
                Try Again
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile) {
    return <ProfileSetup userId={session.user.id} onComplete={setProfile} />;
  }

  return (
    <>
      <MainApp profile={profile} setProfile={setProfile} />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

// Auth Screen Component
function AuthScreen() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) alert('Error signing in: ' + error.message);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">realme</h1>
          <p className="text-gray-600">Connect with everyone, everywhere</p>
        </div>
        
        <button
          onClick={signInWithGoogle}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-lg px-6 py-3 font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// Profile Setup Component
function ProfileSetup({ userId, onComplete }: ProfileSetupProps) {
  const [userIdInput, setUserIdInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const checkAvailability = async (id: string) => {
    if (!id || id.length < 3) {
      setAvailable(null);
      return;
    }

    setChecking(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', id)
      .single();

    setAvailable(!data);
    setChecking(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userIdInput) checkAvailability(userIdInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [userIdInput]);

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!available) {
      setError('Please choose an available user ID');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          user_id: userIdInput,
          display_name: displayName || userIdInput,
        },
      ])
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else {
      onComplete(data);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Create Your Profile</h2>
        
        <form onSubmit={createProfile} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID (unique identifier)
            </label>
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="username_123"
              required
              minLength={3}
            />
            {checking && <p className="text-sm text-gray-500 mt-1">Checking...</p>}
            {available === true && <p className="text-sm text-green-600 mt-1">✓ Available</p>}
            {available === false && <p className="text-sm text-red-600 mt-1">✗ Already taken</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!available || checking}
            className="w-full bg-blue-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  );
}

// Main App Component
function MainApp({ profile, setProfile }: MainAppProps) {
  const [activeView, setActiveView] = useState<'chats' | 'people' | 'invites'>('chats');
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dms, setDMs] = useState<DirectMessage[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);

  useEffect(() => {
    loadGroups();
    loadDMs();
    loadInvites();
  }, [profile]);

  const loadGroups = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, groups(*)')
      .eq('user_id', profile.id);

    if (data) {
      setGroups(data.map(gm => gm.groups));
    }
  };

  const loadDMs = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(*), recipient:profiles!messages_recipient_id_fkey(*)')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      const dmMap = new Map();
      data.forEach(msg => {
        const otherId = msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id;
        if (!dmMap.has(otherId)) {
          dmMap.set(otherId, {
            id: otherId,
            user: msg.sender_id === profile.id ? msg.recipient : msg.sender,
            lastMessage: msg,
          });
        }
      });
      setDMs(Array.from(dmMap.values()));
    }
  };

  const loadInvites = async () => {
    const { data } = await supabase
      .from('invites')
      .select('*, groups(*), invited_by_profile:profiles!invites_invited_by_fkey(*)')
      .eq('invited_user_id', profile.user_id)
      .eq('status', 'pending');

    if (data) {
      setInvites(data);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-blue-600">realme</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={signOut}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('chats')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                activeView === 'chats'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveView('invites')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition relative ${
                activeView === 'invites'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Invites
              {invites.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {invites.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chat/Invite List */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'chats' ? (
            <>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="w-full bg-blue-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Create Group
                </button>
                <button
                  onClick={() => setShowInviteInput(true)}
                  className="w-full bg-green-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
                >
                  <UserPlus size={20} />
                  Join with Code
                </button>
                <button
                  onClick={() => setShowNewDM(true)}
                  className="w-full bg-purple-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-purple-600 transition flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  New DM
                </button>
              </div>

              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Groups</h3>
                {groups.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No groups yet</p>
                ) : (
                  groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedChat({ type: 'group', data: group })}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                        selectedChat?.type === 'group' && (selectedChat.data as Group).id === group.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          <Users size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{group.name}</p>
                          <p className="text-sm text-gray-500 truncate">{group.description || 'No description'}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Direct Messages</h3>
                {dms.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
                ) : (
                  dms.map(dm => {
                    // Skip rendering if user data is invalid
                    if (!dm?.user?.user_id) return null;

                    const displayName = dm.user?.display_name || dm.user?.user_id || 'Unknown User';
                    const userId = dm.user?.user_id;
                    const initial = displayName[0]?.toUpperCase() || '?';

                    return (
                      <button
                        key={dm.id}
                        onClick={() => setSelectedChat({ type: 'dm', data: dm.user })}
                        className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                          selectedChat?.type === 'dm' && (selectedChat.data as DirectMessage['user']).user_id === userId
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{displayName}</p>
                            <p className="text-sm text-gray-500 truncate">@{userId}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <InvitesList 
              invites={invites} 
              profile={profile}
              onUpdate={() => {
                loadInvites();
                loadGroups();
              }}
            />
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <ChatView chat={selectedChat} profile={profile} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-xl">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          profile={profile}
          onCreated={loadGroups}
        />
      )}

      {showSettings && (
        <SettingsModal
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdate={setProfile}
        />
      )}

      {showInviteInput && (
        <JoinGroupModal
          onClose={() => setShowInviteInput(false)}
          profile={profile}
          onJoined={loadGroups}
        />
      )}
      
      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          profile={profile}
          onDMStarted={(user) => {
            setSelectedChat({ type: 'dm', data: user });
            setShowNewDM(false);
          }}
        />
      )}
    </div>
  );
}

// Invites List Component
function InvitesList({ invites, profile, onUpdate }: InvitesListProps) {
  const acceptInvite = async (invite: Invite) => {
    const { error: updateError } = await supabase
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    if (updateError) {
      alert('Error accepting invite: ' + updateError.message);
      return;
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert([
        {
          group_id: invite.group_id,
          user_id: profile.id,
        },
      ]);

    if (memberError) {
      alert('Error joining group: ' + memberError.message);
    } else {
      onUpdate();
    }
  };

  const declineInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    if (error) {
      alert('Error declining invite: ' + error.message);
    } else {
      onUpdate();
    }
  };

  if (invites.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No pending invites</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {invites.map(invite => (
        <div key={invite.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <Users size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{invite.groups.name}</p>
              <p className="text-sm text-gray-500">
                Invited by @{invite.invited_by_profile.user_id}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => acceptInvite(invite)}
              className="flex-1 bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-600 transition"
            >
              Accept
            </button>
            <button
              onClick={() => declineInvite(invite.id)}
              className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Chat View Component
function ChatView({ chat, profile }: ChatViewProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    let query = supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(*)')
      .order('created_at', { ascending: true });

    if (chat.type === 'group') {
      query = query.eq('group_id', (chat.data as Group).id);
    } else {
      const dmUser = chat.data as DirectMessage['user'];
      query = query.or(`and(sender_id.eq.${profile.id},recipient_id.eq.${dmUser.id}),and(sender_id.eq.${dmUser.id},recipient_id.eq.${profile.id})`);
    }

    const { data } = await query;
    if (data) setMessages(data);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageData: MessageData = {
      content: newMessage,
      sender_id: profile.id,
    };

    if (chat.type === 'group') {
      messageData.group_id = (chat.data as Group).id;
    } else {
      messageData.recipient_id = (chat.data as DirectMessage['user']).id;
    }

    const { error } = await supabase
      .from('messages')
      .insert([messageData]);

    if (error) {
      alert('Error sending message: ' + error.message);
    } else {
      setNewMessage('');
    }
  };

  return (
    <>
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${chat.type === 'group' ? 'bg-blue-500' : 'bg-purple-500'} rounded-full flex items-center justify-center text-white font-bold`}>
              {chat.type === 'group' ? (
                <Users size={24} />
              ) : (
                ((chat.data as DirectMessage['user']).display_name?.[0]?.toUpperCase() || 
                 (chat.data as DirectMessage['user']).user_id[0].toUpperCase())
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {chat.type === 'group' 
                  ? (chat.data as Group).name 
                  : (chat.data as DirectMessage['user']).display_name || (chat.data as DirectMessage['user']).user_id}
              </h2>
              {chat.type === 'dm' && (
                <p className="text-sm text-gray-500">@{(chat.data as DirectMessage['user']).user_id}</p>
              )}
            </div>
          </div>
          
          {chat.type === 'group' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowMembers(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <Users size={18} />
                Members
              </button>
              {(chat.data as Group).creator_id === profile.id && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                >
                  <UserPlus size={18} />
                  Invite
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          if (!msg?.sender?.user_id) return null;

          const isOwnMessage = msg.sender_id === profile.id;
          const displayName = msg.sender?.display_name || msg.sender?.user_id || 'Unknown User';
          const initial = displayName[0]?.toUpperCase() || '?';
          const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 ${isOwnMessage ? 'bg-green-500' : 'bg-gray-400'} rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {initial}
              </div>
              <div className={`max-w-md ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {!isOwnMessage && chat.type === 'group' && (
                  <p className="text-xs text-gray-500 mb-1">
                    {displayName}
                  </p>
                )}
                <div className={`rounded-lg px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p>{msg.content}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">{timestamp}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-lg px-6 py-2 font-medium hover:bg-blue-600 transition flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Modals */}
      {showInvite && chat.type === 'group' && (
        <InviteModal
          group={chat.data as Group}
          profile={profile}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showMembers && chat.type === 'group' && (
        <MembersModal
          group={chat.data as Group}
          profile={profile}
          isCreator={(chat.data as Group).creator_id === profile.id}
          onClose={() => setShowMembers(false)}
        />
      )}
    </>
  );
}

// Create Group Modal
function CreateGroupModal({ onClose, profile, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    const { error } = await supabase
      .from('groups')
      .insert([
        {
          name,
          description,
          creator_id: profile.id,
        },
      ])
      .select()
      .single();

    if (error) {
      alert('Error creating group: ' + error.message);
      setCreating(false);
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Create Group</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="My Awesome Group"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What's this group about?"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-blue-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Join Group Modal
function JoinGroupModal({ onClose, profile, onJoined }: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (groupError || !group) {
      alert('Invalid invite code');
      setJoining(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert([
        {
          group_id: group.id,
          user_id: profile.id,
        },
      ]);

    if (memberError) {
      if (memberError.code === '23505') {
        alert('You are already a member of this group');
      } else {
        alert('Error joining group: ' + memberError.message);
      }
      setJoining(false);
    } else {
      onJoined();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Join Group</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              placeholder="ABC123XY"
              required
              maxLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={joining}
            className="w-full bg-green-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-green-600 transition disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join Group'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Invite Modal
function InviteModal({ group, profile, onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [userIdToInvite, setUserIdToInvite] = useState('');
  const [sending, setSending] = useState(false);

  const copyCode = () => {
    if (group.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const { data: invitedUser, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userIdToInvite)
      .single();

    if (userError || !invitedUser) {
      alert('User not found');
      setSending(false);
      return;
    }

    const { error } = await supabase
      .from('invites')
      .insert([
        {
          group_id: group.id,
          invited_user_id: userIdToInvite,
          invited_by: profile.id,
        },
      ]);

    if (error) {
      if (error.code === '23505') {
        alert('Invite already sent to this user');
      } else {
        alert('Error sending invite: ' + error.message);
      }
      setSending(false);
    } else {
      alert('Invite sent!');
      setUserIdToInvite('');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Invite to {group.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invite Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={group.invite_code || ''}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono"
              />
              <button
                onClick={copyCode}
                className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <form onSubmit={sendInvite}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invite by User ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={userIdToInvite}
                onChange={(e) => setUserIdToInvite(e.target.value.toLowerCase())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="username"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending}
                className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition disabled:opacity-50"
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Members Modal
function MembersModal({ group, profile, isCreator, onClose }: MembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', group.id);

    if (data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    if (memberId === profile.id) {
      alert('You cannot remove yourself from the group');
      return;
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', memberId);

    if (error) {
      alert('Error removing member: ' + error.message);
    } else {
      loadMembers();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Members</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-gray-500 py-4">Loading...</p>
          ) : (
            members.map(member => (
              <div key={`${member.group_id}-${member.user_id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {member.profiles.display_name?.[0]?.toUpperCase() || member.profiles.user_id[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.profiles.display_name}</p>
                    <p className="text-sm text-gray-500">@{member.profiles.user_id}</p>
                  </div>
                </div>
                
                {isCreator && member.user_id !== group.creator_id && (
                  <button 
                    onClick={() => removeMember(member.user_id)}
                    className="text-red-500 hover:text-red-600 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                
                {member.user_id === group.creator_id && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    Creator
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// New DM Modal
function NewDMModal({ onClose, profile, onDMStarted }: NewDMModalProps) {
  const [searchUserId, setSearchUserId] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  const searchUser = async () => {
    if (!searchUserId.trim()) return;
    setSearching(true);
    setError('');
    setFoundUser(null);

    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', searchUserId.trim())
      .single();

    if (searchError || !data) {
      setError('User not found');
    } else if (data.user_id === profile.user_id) {
      setError('You cannot start a DM with yourself');
    } else {
      setFoundUser(data);
    }
    setSearching(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">New Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value.toLowerCase())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter user ID"
                disabled={searching}
              />
              <button
                onClick={searchUser}
                disabled={searching || !searchUserId.trim()}
                className="bg-blue-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-600 transition disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>

          {foundUser && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {foundUser.display_name?.[0]?.toUpperCase() || foundUser.user_id[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{foundUser.display_name || foundUser.user_id}</p>
                  <p className="text-sm text-gray-500">@{foundUser.user_id}</p>
                </div>
              </div>
              <button
                onClick={() => onDMStarted(foundUser)}
                className="w-full mt-4 bg-purple-500 text-white rounded-lg px-4 py-2 font-medium hover:bg-purple-600 transition flex items-center justify-center gap-2"
              >
                <MessageCircle size={20} />
                Start Conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Settings Modal
function SettingsModal({ profile, onClose, onUpdate }: SettingsModalProps) {
  const [newUserId, setNewUserId] = useState(profile.user_id);
  const [newDisplayName, setNewDisplayName] = useState(profile.display_name || '');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const checkAvailability = async (id: string) => {
    if (!id || id.length < 3 || id === profile.user_id) {
      setAvailable(null);
      return;
    }

    setChecking(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', id)
      .single();

    setAvailable(!data);
    setChecking(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newUserId !== profile.user_id) checkAvailability(newUserId);
    }, 500);
    return () => clearTimeout(timer);
  }, [newUserId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newUserId !== profile.user_id && !available) {
      alert('Please choose an available user ID');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        user_id: newUserId,
        display_name: newDisplayName,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      alert('Error updating profile: ' + error.message);
      setSaving(false);
    } else {
      onUpdate(data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={3}
            />
            {checking && <p className="text-sm text-gray-500 mt-1">Checking...</p>}
            {available === true && newUserId !== profile.user_id && (
              <p className="text-sm text-green-600 mt-1">✓ Available</p>
            )}
            {available === false && newUserId !== profile.user_id && (
              <p className="text-sm text-red-600 mt-1">✗ Already taken</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your Name"
            />
          </div>

          <button
            type="submit"
            disabled={saving || (newUserId !== profile.user_id && !available)}
            className="w-full bg-blue-500 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
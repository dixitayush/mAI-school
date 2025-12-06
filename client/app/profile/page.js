"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import { User, Mail, Phone, MapPin, Camera, Save, X, Briefcase, Calendar, GraduationCap, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const GET_USER_PROFILE = gql`
  query GetUserProfile($id: UUID!) {
    userById(id: $id) {
      id
      username
      fullName
      role
      profileByUserId {
        bio
        email
        phone
        address
        photoUrl
      }
      studentByUserId {
        classByClassId {
          name
        }
        parentContact
        dob
        enrollmentDate
      }
      teacherByUserId {
        subjectSpecialization
        qualification
        joiningDate
      }
    }
  }
`;

const UPDATE_PROFILE = gql`
  mutation UpdateProfile($userId: UUID!, $bio: String, $email: String, $phone: String, $address: String, $photoUrl: String) {
    updateProfileByUserId(input: {
      userId: $userId,
      profilePatch: {
        bio: $bio,
        email: $email,
        phone: $phone,
        address: $address,
        photoUrl: $photoUrl
      }
    }) {
      profile {
        userId
        bio
        email
        phone
        address
        photoUrl
      }
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($id: UUID!, $fullName: String!) {
    updateUserById(input: {
      id: $id,
      userPatch: {
        fullName: $fullName
      }
    }) {
      user {
        id
        fullName
      }
    }
  }
`;

function ProfileContent() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [activeTab, setActiveTab] = useState('personal');
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        bio: '',
        email: '',
        phone: '',
        address: '',
        photoUrl: ''
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        console.log("Stored user from localStorage:", storedUser);
        if (!storedUser) {
            router.push('/login');
        } else {
            const parsedUser = JSON.parse(storedUser);
            console.log("Parsed user ID:", parsedUser.id);
            setUserId(parsedUser.id);
        }
    }, [router]);

    const { loading, error, data, refetch } = useQuery(GET_USER_PROFILE, {
        variables: { id: userId },
        skip: !userId,
        onCompleted: (data) => {
            console.log("Query completed with data:", data);
            if (data?.userById) {
                const { fullName, profileByUserId } = data.userById;
                setFormData({
                    fullName: fullName || '',
                    bio: profileByUserId?.bio || '',
                    email: profileByUserId?.email || '',
                    phone: profileByUserId?.phone || '',
                    address: profileByUserId?.address || '',
                    photoUrl: profileByUserId?.photoUrl || ''
                });
            }
        },
        onError: (err) => {
            console.error("Query error:", err);
        }
    });

    const [updateProfile] = useMutation(UPDATE_PROFILE);
    const [updateUser] = useMutation(UPDATE_USER);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/upload`, {
                method: 'POST',
                body: uploadData,
            });
            const result = await res.json();
            if (result.success) {
                const newPhotoUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${result.fileUrl}`;
                setFormData(prev => ({ ...prev, photoUrl: newPhotoUrl }));

                // Auto-save photo update
                await updateProfile({
                    variables: {
                        userId,
                        photoUrl: newPhotoUrl
                    }
                });
                refetch();
            }
        } catch (err) {
            console.error('Upload failed', err);
            toast.error('Failed to upload image');
        }
    };

    const handleSave = async () => {
        try {
            await updateUser({
                variables: {
                    id: userId,
                    fullName: formData.fullName
                }
            });

            await updateProfile({
                variables: {
                    userId,
                    bio: formData.bio,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    photoUrl: formData.photoUrl
                }
            });

            setIsEditing(false);
            refetch();
            toast.success('Profile updated successfully!');
        } catch (err) {
            console.error('Update failed', err);
            toast.error('Failed to update profile: ' + err.message);
        }
    };

    if (!userId || loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
            Error loading profile: {error.message}
        </div>
    );

    const user = data.userById;
    const roleDetails = user.role === 'student' ? user.studentByUserId :
        user.role === 'teacher' ? user.teacherByUserId : null;

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
            <Sidebar />

            <main className="flex-1 ml-64 relative">
                {/* Gradient Header */}
                <div className="h-64 bg-gradient-to-r from-primary-600 via-primary-500 to-teal-400 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                <div className="max-w-5xl mx-auto px-8 pb-12 -mt-24 relative z-10">
                    {/* Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden"
                    >
                        <div className="p-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                                    {/* Avatar */}
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-full p-1 bg-white shadow-lg ring-4 ring-white/50">
                                            {formData.photoUrl ? (
                                                <img src={formData.photoUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-primary-100 rounded-full flex items-center justify-center text-primary-500">
                                                    <User className="w-12 h-12" />
                                                </div>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2.5 rounded-full shadow-lg cursor-pointer hover:bg-primary-600 transition-all hover:scale-110 active:scale-95">
                                                <Camera className="w-5 h-5" />
                                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                                            </label>
                                        )}
                                    </div>

                                    {/* Name & Role */}
                                    <div className="text-center md:text-left mb-2">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                                className="text-3xl font-bold text-gray-900 bg-transparent border-b-2 border-primary-300 focus:border-primary-500 outline-none px-1 w-full md:w-auto"
                                                placeholder="Your Name"
                                            />
                                        ) : (
                                            <h1 className="text-3xl font-bold text-gray-900">{user.fullName}</h1>
                                        )}
                                        <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                                            <span className="px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold uppercase tracking-wide">
                                                {user.role}
                                            </span>
                                            {user.role === 'student' && roleDetails?.classByClassId && (
                                                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                                                    Class {roleDetails.classByClassId.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-6 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
                                            >
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-6 py-2.5 rounded-xl font-medium text-white bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                            >
                                                <Save className="w-4 h-4" /> Save Changes
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-6 py-2.5 rounded-xl font-medium text-white bg-gray-900 hover:bg-gray-800 shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                        >
                                            <Briefcase className="w-4 h-4" /> Edit Profile
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="mt-10 border-b border-gray-100 flex gap-8">
                                {['personal', 'academic'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative ${activeTab === tab ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        {tab === 'personal' ? 'Personal Details' : 'Academic Info'}
                                        {activeTab === tab && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="p-8 bg-gray-50/50">
                            <AnimatePresence mode="wait">
                                {activeTab === 'personal' ? (
                                    <motion.div
                                        key="personal"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                                    >
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <Mail className="w-5 h-5 text-primary-500" /> Contact Info
                                                </h3>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Email Address</label>
                                                        {isEditing ? (
                                                            <input
                                                                type="email"
                                                                value={formData.email}
                                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700 font-medium">{formData.email || 'Not set'}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Phone Number</label>
                                                        {isEditing ? (
                                                            <input
                                                                type="tel"
                                                                value={formData.phone}
                                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                                            />
                                                        ) : (
                                                            <p className="text-gray-700 font-medium">{formData.phone || 'Not set'}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <MapPin className="w-5 h-5 text-primary-500" /> Address
                                                </h3>
                                                {isEditing ? (
                                                    <textarea
                                                        value={formData.address}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                        rows="3"
                                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                                                    />
                                                ) : (
                                                    <p className="text-gray-700 font-medium leading-relaxed">{formData.address || 'Not set'}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                <User className="w-5 h-5 text-primary-500" /> Bio
                                            </h3>
                                            {isEditing ? (
                                                <textarea
                                                    value={formData.bio}
                                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                                    rows="8"
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                                                    placeholder="Tell us about yourself..."
                                                />
                                            ) : (
                                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                    {formData.bio || 'No bio available yet. Click edit to add one!'}
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="academic"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                                    >
                                        {user.role === 'student' && roleDetails ? (
                                            <>
                                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                        <GraduationCap className="w-5 h-5 text-blue-500" /> Student Details
                                                    </h3>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Class</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.classByClassId?.name || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Date of Birth</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.dob || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Enrollment Date</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.enrollmentDate || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                        <Phone className="w-5 h-5 text-green-500" /> Parent Contact
                                                    </h3>
                                                    <p className="text-gray-700 font-medium text-lg">{roleDetails.parentContact || 'Not set'}</p>
                                                </div>
                                            </>
                                        ) : user.role === 'teacher' && roleDetails ? (
                                            <>
                                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                        <BookOpen className="w-5 h-5 text-purple-500" /> Professional Info
                                                    </h3>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Specialization</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.subjectSpecialization || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Qualification</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.qualification || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-gray-50 pb-3">
                                                            <span className="text-gray-500">Joining Date</span>
                                                            <span className="font-semibold text-gray-900">{roleDetails.joiningDate || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="col-span-2 text-center py-12 text-gray-400">
                                                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                <p>No additional role-specific details available.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <ApolloWrapper>
            <ProfileContent />
        </ApolloWrapper>
    );
}

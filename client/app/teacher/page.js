"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { Calendar, CheckSquare, Upload, Camera, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

function TeacherDashboardContent() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [aiResult, setAiResult] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'teacher') {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleAiAttendance = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setAiResult(null);

        try {
            // 1. Upload the file
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error('File upload failed');
            }

            // 2. Call AI Service with the file URL
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/ai/attendance`, {
                method: 'POST',
                body: JSON.stringify({
                    classId: 'mock-class-id',
                    imageUrl: uploadData.fileUrl
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();
            setAiResult(data);
        } catch (err) {
            console.error(err);
            toast.error('AI Processing Failed: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h1>
                    <p className="text-gray-500">Welcome, {user.full_name}</p>
                </div>
                <button onClick={handleLogout} className="text-red-600 hover:text-red-700 font-medium">
                    Logout
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Camera className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">AI Auto-Attendance</h2>
                    </div>

                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors relative">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleAiAttendance}
                            accept="image/*"
                            disabled={isUploading}
                        />
                        {isUploading ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                                <p className="text-gray-600 font-medium">Analyzing Classroom Photo...</p>
                                <p className="text-xs text-gray-400 mt-1">Detecting faces and matching students</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-gray-600 font-medium">Upload Class Photo</p>
                                <p className="text-xs text-gray-400 mt-1">Drag and drop or click to browse</p>
                            </div>
                        )}
                    </div>

                    {aiResult && (
                        <div className="mt-6 bg-green-50 border border-green-100 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-green-800">Attendance Marked!</h3>
                                <span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                                    {aiResult.detected_faces} Students Detected
                                </span>
                            </div>
                            <p className="text-sm text-green-700">{aiResult.message}</p>
                        </div>
                    )}
                </div>

                <div
                    onClick={() => router.push('/teacher/attendance')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <CheckSquare className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Manual Attendance</h2>
                    </div>
                    <p className="text-gray-500 text-sm mb-4">
                        Mark attendance manually for your classes. Send email notifications to parents instantly.
                    </p>
                    <div className="flex items-center text-purple-600 font-medium text-sm">
                        Go to Attendance Dashboard &rarr;
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Today's Schedule</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <p className="font-bold text-gray-800">Mathematics (10-A)</p>
                                <p className="text-sm text-gray-500">09:00 AM - 10:00 AM</p>
                            </div>
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Completed</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <p className="font-bold text-gray-800">Physics (11-B)</p>
                                <p className="text-sm text-gray-500">11:00 AM - 12:00 PM</p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Upcoming</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TeacherPage() {
    return (
        <ApolloWrapper>
            <TeacherDashboardContent />
        </ApolloWrapper>
    );
}

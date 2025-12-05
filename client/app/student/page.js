"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Book, Calendar, Award, LogOut } from 'lucide-react';

export default function StudentDashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || (role !== 'student' && role !== 'admin')) {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Book className="text-white w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">Student Portal</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-gray-600 font-medium">{user.full_name}</span>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8 shadow-lg">
                    <h2 className="text-3xl font-bold mb-2">Hello, {user.full_name.split(' ')[0]}!</h2>
                    <p className="text-blue-100">You have 2 upcoming exams this week. Keep up the good work!</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Results Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">Recent Results</h3>
                            <Award className="text-yellow-500 w-5 h-5" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Mathematics</span>
                                <span className="font-bold text-green-600">92/100</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Physics</span>
                                <span className="font-bold text-blue-600">85/100</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">English</span>
                                <span className="font-bold text-gray-600">78/100</span>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">Attendance</h3>
                            <Calendar className="text-green-500 w-5 h-5" />
                        </div>
                        <div className="flex items-center justify-center h-32">
                            <div className="text-center">
                                <span className="text-4xl font-bold text-gray-800">96%</span>
                                <p className="text-xs text-gray-500 mt-1">Present Days</p>
                            </div>
                        </div>
                    </div>

                    {/* AI Study Buddy */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-purple-100 rounded-bl-full -mr-8 -mt-8"></div>
                        <h3 className="font-bold text-gray-800 mb-2 relative z-10">AI Study Buddy</h3>
                        <p className="text-sm text-gray-600 mb-4 relative z-10">Need help with homework? Ask your AI assistant.</p>
                        <button className="w-full py-2 bg-purple-100 text-purple-700 font-bold rounded-lg text-sm hover:bg-purple-200 transition-colors relative z-10">
                            Start Chat
                        </button>
                    </div>

                </div>
            </main>
        </div>
    );
}

"use client";

import Sidebar from '@/components/Sidebar';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { Bell, Search, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import NotificationListener from '@/components/NotificationListener';

export default function PrincipalLayout({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    return (
        <ApolloWrapper>
            <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
                {/* Persistent Sidebar */}
                <Sidebar userRole="principal" />
                <NotificationListener userRole="principal" />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all duration-300">

                    {/* Top Navigation Bar */}
                    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex items-center justify-between">
                        {/* Search Bar */}
                        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 w-96 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
                            <Search className="w-5 h-5 text-gray-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Search students, classes, reports..."
                                className="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder-gray-400"
                            />
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center space-x-6">
                            <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <Bell className="w-5 h-5 text-gray-600" />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>

                            <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-gray-900">{user?.full_name || 'Principal'}</p>
                                    <p className="text-xs text-gray-500">School Principal</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-red-500 p-0.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                                        <User className="w-5 h-5 text-gray-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <main className="flex-1 p-8 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {children}
                        </motion.div>
                    </main>
                </div>
            </div>
        </ApolloWrapper>
    );
}

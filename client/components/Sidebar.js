"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Users, GraduationCap, BookOpen, DollarSign, LogOut, FileText, User, LayoutDashboard, Settings, CheckCircle, Calendar, Bell, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';

const menuItems = {
    admin: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Students', href: '/admin/users/students', icon: GraduationCap },
        { name: 'Teachers', href: '/admin/users/teachers', icon: BookOpen },
        { name: 'Classes', href: '/admin/classes', icon: BookOpen },
        { name: 'Attendance', href: '/admin/attendance', icon: CheckCircle },
        { name: 'Fees', href: '/admin/fees', icon: DollarSign },
        { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
        { name: 'Exams', href: '/exams', icon: FileText },
        { name: 'Profile', href: '/profile', icon: User },
    ],
    teacher: [
        { name: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
        { name: 'Attendance', href: '/teacher/attendance', icon: CheckCircle },
        { name: 'Exams', href: '/teacher/exams', icon: FileText },
        { name: 'Profile', href: '/profile', icon: User },
    ],
    principal: [
        { name: 'Dashboard', href: '/principal', icon: LayoutDashboard },
        { name: 'Calendar', href: '/principal/calendar', icon: Calendar },
        { name: 'Students', href: '/admin/users/students', icon: GraduationCap },
        { name: 'Teachers', href: '/admin/users/teachers', icon: BookOpen },
        { name: 'Fees', href: '/admin/fees', icon: DollarSign },
        { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
        { name: 'Exams', href: '/exams', icon: FileText },
        { name: 'Profile', href: '/profile', icon: User },
    ],
    student: [
        { name: 'Dashboard', href: '/student', icon: LayoutDashboard },
        { name: 'Fees', href: '/student/fees', icon: DollarSign },
        { name: 'Exams', href: '/exams', icon: FileText },
        { name: 'Profile', href: '/profile', icon: User },
    ]
};

export default function Sidebar({ userRole = 'admin' }) {
    const pathname = usePathname();
    const router = useRouter();

    // Default to admin if role not found or invalid
    const items = menuItems[userRole] || menuItems['admin'];

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 z-30 hidden md:flex flex-col">
            {/* Logo Section */}
            <div className="p-8 pb-4">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                        <span className="text-white font-bold text-xl tracking-tighter">mAI</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">EduFlow</h1>
                        <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mt-1">Management OS</p>
                    </div>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
                {items.map((item, index) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <motion.a
                            key={item.href}
                            href={item.href}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            className={`
                                flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                                ${isActive
                                    ? 'bg-primary-50/50 text-primary-700 shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-primary-50 rounded-xl -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <Icon
                                strokeWidth={isActive ? 2.5 : 2}
                                className={`w-5 h-5 transition-colors ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                            />
                            <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
                        </motion.a>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl w-full transition-all duration-200 group"
                >
                    <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    <span className="font-medium text-sm">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}

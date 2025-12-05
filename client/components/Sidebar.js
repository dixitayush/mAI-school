"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Users, GraduationCap, BookOpen, DollarSign, LogOut, FileText, User, LayoutDashboard, Settings, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const menuItems = {
    admin: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Students', href: '/admin/users/students', icon: GraduationCap },
        { name: 'Teachers', href: '/admin/users/teachers', icon: BookOpen },
        { name: 'Attendance', href: '/teacher/attendance', icon: CheckCircle },
        { name: 'Fees', href: '/admin/fees', icon: DollarSign },
        { name: 'Exams', href: '/exams', icon: FileText },
        { name: 'Profile', href: '/profile', icon: User },
    ],
    teacher: [
        { name: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
        { name: 'Attendance', href: '/teacher/attendance', icon: CheckCircle },
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
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out z-20 hidden md:block shadow-sm">
            {/* Logo Section */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">mAI</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">EduFlow</h1>
                        <p className="text-xs text-gray-500">School Management</p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-4 space-y-1">
                {items.map((item, index) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <motion.a
                            key={item.href}
                            href={item.href}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive
                                    ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                group
              `}
                        >
                            <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-primary-600' : ''}`} />
                            <span>{item.name}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="activeIndicator"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </motion.a>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg w-full transition-all duration-200 group"
                >
                    <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}

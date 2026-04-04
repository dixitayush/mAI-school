"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import { Menu } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import StatCard from '@/components/StatCard';
import Calendar from '@/components/Calendar';
import AnnouncementCard from '@/components/AnnouncementCard';
import { Users, GraduationCap, BookOpen, DollarSign, Activity, TrendingUp, ChevronDown, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { generateDashboardReport } from '@/lib/generateReport';

const GET_STATS = gql`
  query GetStats {
    allUsers {
      totalCount
    }
    allStudents {
      totalCount
    }
    allTeachers {
      totalCount
    }
    allFees {
      nodes {
        amount
        status
      }
    }
    allAttendances {
      nodes {
        date
        status
      }
    }
  }
`;

export default function AdminDashboard() {
    const router = useRouter();
    const { loading, error, data } = useQuery(GET_STATS);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'admin') {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleDownloadReport = () => {
        try {
            const reportData = {
                students: data?.allStudents?.totalCount || 0,
                teachers: data?.allTeachers?.totalCount || 0,
                revenue: totalFees,
                attendance: '94%',
                feeBreakdown: feeStatusData,
                totalFees: feeStatusData.reduce((sum, item) => sum + item.value, 0),
                attendanceData: attendanceData
            };

            generateDashboardReport(reportData);
            toast.success('Report downloaded successfully!');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Failed to generate report');
        }
    };

    if (!user) return null;

    // Calculate fee statistics
    const totalFees = data?.allFees?.nodes.reduce((sum, fee) => sum + parseFloat(fee.amount), 0) || 0;

    // Calculate Attendance Data by Month dynamically
    const attendances = data?.allAttendances?.nodes || [];
    const monthlyAttendance = {};

    attendances.forEach(att => {
        const date = new Date(att.date);
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!monthlyAttendance[month]) {
            monthlyAttendance[month] = { total: 0, present: 0 };
        }
        
        monthlyAttendance[month].total += 1;
        if (att.status === 'present') {
            monthlyAttendance[month].present += 1;
        }
    });

    // Default months if no data exists yet to keep the chart from looking empty
    const defaultMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const attendanceData = Object.keys(monthlyAttendance).length > 0 
        ? Object.keys(monthlyAttendance).map(month => ({
            month,
            rate: Math.round((monthlyAttendance[month].present / monthlyAttendance[month].total) * 100)
        }))
        : defaultMonths.map(month => ({ month, rate: 0 }));

    // Calculate average attendance for the stat card
    const totalAttendanceRecords = attendances.length;
    const totalPresentRecords = attendances.filter(a => a.status === 'present').length;
    const averageAttendanceRate = totalAttendanceRecords > 0 
        ? Math.round((totalPresentRecords / totalAttendanceRecords) * 100)
        : 0;

    const feeStatusData = [
        { name: 'Paid', value: data?.allFees?.nodes.filter(f => f.status === 'paid').length || 0, color: '#34D399' }, // Emerald-400
        { name: 'Pending', value: data?.allFees?.nodes.filter(f => f.status === 'pending').length || 0, color: '#FBBF24' }, // Amber-400
        { name: 'Overdue', value: data?.allFees?.nodes.filter(f => f.status === 'overdue').length || 0, color: '#F87171' }, // Red-400
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* Welcome Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Overview</h1>
                    <p className="text-zinc-500 mt-1">Metrics and analytics for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleDownloadReport}
                        className="bg-white border border-zinc-200 text-zinc-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors flex items-center space-x-2"
                    >
                        <Download className="w-4 h-4" />
                        <span>Download Report</span>
                    </button>
                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/30 flex items-center space-x-2">
                            <span>Create New</span>
                            <ChevronDown className="w-4 h-4" />
                        </Menu.Button>
                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10 divide-y divide-zinc-100">
                            <div className="py-1">
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => router.push('/admin/users/students')}
                                            className={`${active ? 'bg-primary-50 text-primary-700' : 'text-zinc-700'
                                                } group flex w-full items-center px-4 py-2 text-sm font-medium transition-colors`}
                                        >
                                            <GraduationCap className="mr-3 h-5 w-5" aria-hidden="true" />
                                            Create Student
                                        </button>
                                    )}
                                </Menu.Item>
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => router.push('/admin/users/teachers')}
                                            className={`${active ? 'bg-primary-50 text-primary-700' : 'text-zinc-700'
                                                } group flex w-full items-center px-4 py-2 text-sm font-medium transition-colors`}
                                        >
                                            <BookOpen className="mr-3 h-5 w-5" aria-hidden="true" />
                                            Create Teacher
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                            <div className="py-1">
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => router.push('/admin/classes')}
                                            className={`${active ? 'bg-primary-50 text-primary-700' : 'text-zinc-700'
                                                } group flex w-full items-center px-4 py-2 text-sm font-medium transition-colors`}
                                        >
                                            <Users className="mr-3 h-5 w-5" aria-hidden="true" />
                                            Create Class
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Menu>
                </div>
            </div>

            {/* Stats Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Students"
                    value={data?.allStudents?.totalCount || 0}
                    icon={GraduationCap}
                    trend="up"
                    trendValue="+12%"
                    color="primary"
                />
                <StatCard
                    title="Active Teachers"
                    value={data?.allTeachers?.totalCount || 0}
                    icon={BookOpen}
                    trend="up"
                    trendValue="+3%"
                    color="blue"
                    delay={0.1}
                />
                <StatCard
                    title="Revenue"
                    value={`$${totalFees.toLocaleString()}`}
                    icon={DollarSign}
                    trend="up"
                    trendValue="+18%"
                    color="green"
                    delay={0.2}
                />
                <StatCard
                    title="Avg Attendance"
                    value={`${averageAttendanceRate}%`}
                    icon={Activity}
                    trend="up"
                    trendValue="Active"
                    color="orange"
                    delay={0.3}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <motion.div
                    variants={itemVariants}
                    className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-zinc-100"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900">Attendance Overview</h3>
                            <p className="text-sm text-zinc-500">Monthly student attendance trends</p>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-zinc-500">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="font-medium text-emerald-600">+4.5%</span>
                            <span>vs last year</span>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={attendanceData}>
                                <defs>
                                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis
                                    dataKey="month"
                                    stroke="#9CA3AF"
                                    tickLine={false}
                                    axisLine={false}
                                    style={{ fontSize: '12px' }}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    tickLine={false}
                                    axisLine={false}
                                    style={{ fontSize: '12px' }}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fill="url(#colorRate)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Secondary Chart / Info */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 flex flex-col"
                >
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">Fee Collection</h3>
                    <p className="text-sm text-zinc-500 mb-6">Current breakdown of student fees</p>

                    <div className="flex-1 min-h-[200px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={feeStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {feeStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-zinc-900">${(totalFees / 1000).toFixed(1)}k</span>
                            <span className="text-xs text-zinc-400 uppercase font-medium">Total</span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        {feeStatusData.map((item) => (
                            <div key={item.name} className="flex items-center justify-between text-sm group cursor-pointer p-2 hover:bg-zinc-50 rounded-lg transition-colors">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-zinc-600 font-medium">{item.name}</span>
                                </div>
                                <span className="font-bold text-zinc-900 font-mono">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={itemVariants}>
                    <Calendar />
                </motion.div>
                <motion.div variants={itemVariants}>
                    <AnnouncementCard />
                </motion.div>
            </div>
        </motion.div>
    );
}

"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import StatCard from '@/components/StatCard';
import Calendar from '@/components/Calendar';
import AnnouncementCard from '@/components/AnnouncementCard';
import { Users, GraduationCap, BookOpen, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, LineChart } from 'recharts';
import { motion } from 'framer-motion';

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
  }
`;

function AdminDashboardContent() {
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

    if (!user) return null;

    // Calculate fee statistics
    const totalFees = data?.allFees?.nodes.reduce((sum, fee) => sum + parseFloat(fee.amount), 0) || 0;
    const paidFees = data?.allFees?.nodes
        .filter(f => f.status === 'paid')
        .reduce((sum, fee) => sum + parseFloat(fee.amount), 0) || 0;

    // Mock attendance data for line chart
    const attendanceData = [
        { month: 'Jan', rate: 88 },
        { month: 'Feb', rate: 92 },
        { month: 'Mar', rate: 85 },
        { month: 'Apr', rate: 90 },
        { month: 'May', rate: 94 },
        { month: 'Jun', rate: 96 },
        { month: 'Jul', rate: 91 },
        { month: 'Aug', rate: 93 },
        { month: 'Sep', rate: 95 },
        { month: 'Oct', rate: 92 },
        { month: 'Nov', rate: 94 },
        { month: 'Dec', rate: 97 },
    ];

    // Process data for charts
    const feeStatusData = [
        { name: 'Paid', value: data?.allFees?.nodes.filter(f => f.status === 'paid').length || 0, color: '#88B38A' },
        { name: 'Pending', value: data?.allFees?.nodes.filter(f => f.status === 'pending').length || 0, color: '#facc15' },
        { name: 'Overdue', value: data?.allFees?.nodes.filter(f => f.status === 'overdue').length || 0, color: '#f87171' },
    ];

    const userDistributionData = [
        { name: 'Students', count: data?.allStudents?.totalCount || 0 },
        { name: 'Teachers', count: data?.allTeachers?.totalCount || 0 },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
                    <p className="text-gray-500">Welcome back, {user.full_name}! Here's what's happening today.</p>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Students"
                        value={data?.allStudents?.totalCount || 0}
                        icon={GraduationCap}
                        trend="up"
                        trendValue="+12%"
                        color="primary"
                        delay={0}
                    />
                    <StatCard
                        title="Total Teachers"
                        value={data?.allTeachers?.totalCount || 0}
                        icon={BookOpen}
                        trend="up"
                        trendValue="+3%"
                        color="blue"
                        delay={0.1}
                    />
                    <StatCard
                        title="Total Revenue"
                        value={`$${totalFees.toLocaleString()}`}
                        icon={DollarSign}
                        trend="up"
                        trendValue="+18%"
                        color="green"
                        delay={0.2}
                    />
                    <StatCard
                        title="Attendance Rate"
                        value="94%"
                        icon={Users}
                        trend="up"
                        trendValue="+2%"
                        color="purple"
                        delay={0.3}
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Line Chart - Attendance Trends */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100"
                    >
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Attendance Trends</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={attendanceData}>
                                <defs>
                                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#88B38A" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#88B38A" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="month" stroke="#6B7280" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="#88B38A"
                                    strokeWidth={3}
                                    dot={{ fill: '#88B38A', r: 4 }}
                                    activeDot={{ r: 6 }}
                                    fill="url(#colorRate)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* Pie Chart - Fee Status */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
                    >
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fee Status</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={feeStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {feeStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-4 space-y-2">
                            {feeStatusData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-gray-600">{item.name}</span>
                                    </div>
                                    <span className="font-medium text-gray-900">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Bottom Row - Calendar & Announcements */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Calendar />
                    <AnnouncementCard />
                </div>
            </main>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <ApolloWrapper>
            <AdminDashboardContent />
        </ApolloWrapper>
    );
}

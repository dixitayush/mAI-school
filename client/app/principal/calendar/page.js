'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { Calendar as CalendarIcon, Clock, User, Check, X } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { toast } from 'react-hot-toast';

// Basic query to fetch meetings
const GET_MEETINGS = gql`
  query GetMeetings {
    allMeetings {
      nodes {
        id
        startTime
        endTime
        status
        notes
        userByGuestId {
          fullName
          role
        }
      }
    }
  }
`;

function CalendarContent() {
    const { data, loading } = useQuery(GET_MEETINGS);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const meetings = data?.allMeetings?.nodes || [];

    const days = [];
    const start = startOfWeek(new Date());
    for (let i = 0; i < 7; i++) {
        days.push(addDays(start, i));
    }

    return (
        <div className="container mx-auto p-8 max-w-6xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Principal's Schedule</h1>
                    <p className="text-gray-500">Manage meetings with students, teachers, and parents.</p>
                </div>
                <button className="px-5 py-2 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition">
                    + New Meeting
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calendar View */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary-500" />
                        This Week
                    </h2>
                    <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((day, i) => {
                            const isToday = isSameDay(day, new Date());
                            const isSelected = isSameDay(day, selectedDate);
                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                h-24 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                                ${isSelected ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-100 hover:border-gray-200 bg-white'}
                            `}
                                >
                                    <span className={`text-sm font-semibold ${isToday ? 'text-primary-600' : 'text-gray-700'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Agenda View */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Agenda for {format(selectedDate, 'MMM d')}
                    </h2>

                    <div className="space-y-4">
                        {meetings
                            .filter(m => isSameDay(new Date(m.startTime), selectedDate))
                            .length === 0 ? (
                            <p className="text-center text-gray-400 py-8">No meetings scheduled.</p>
                        ) : (
                            meetings
                                .filter(m => isSameDay(new Date(m.startTime), selectedDate))
                                .map(meeting => (
                                    <div key={meeting.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 uppercase">
                                                {format(new Date(meeting.startTime), 'h:mm a')}
                                            </span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    meeting.status === 'scheduled' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {meeting.status}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{meeting.notes}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <User className="w-3 h-3" />
                                            {meeting.userByGuestId?.fullName} ({meeting.userByGuestId?.role})
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CalendarPage() {
    return (
        <ApolloWrapper>
            <CalendarContent />
        </ApolloWrapper>
    );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import DataTable from '@/components/DataTable';
import AnnouncementModal from '@/components/AnnouncementModal';
import { toast } from 'react-hot-toast';
import { getInstitutionIdFromStorage } from '@/lib/tenant';
import { Megaphone, Eye, EyeOff, Trash2, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion } from 'framer-motion';

const GET_ANNOUNCEMENTS = gql`
  query GetAnnouncements {
    allAnnouncements(orderBy: CREATED_AT_DESC) {
      nodes {
        id
        title
        content
        priority
        targetAudience
        isActive
        createdAt
        updatedAt
        userByCreatedBy {
          fullName
        }
      }
    }
  }
`;

const CREATE_ANNOUNCEMENT = gql`
  mutation CreateAnnouncement(
    $title: String!
    $content: String!
    $institutionId: UUID!
    $priority: String
    $targetAudience: String
    $createdBy: UUID
  ) {
    createAnnouncement(input: {
      pTitle: $title
      pContent: $content
      pInstitutionId: $institutionId
      pPriority: $priority
      pTargetAudience: $targetAudience
      pCreatedBy: $createdBy
    }) {
      announcement {
        id
        title
        content
        priority
        targetAudience
        isActive
        createdAt
      }
    }
  }
`;

const UPDATE_ANNOUNCEMENT = gql`
  mutation UpdateAnnouncement(
    $id: UUID!
    $title: String!
    $content: String!
    $priority: String
    $targetAudience: String
    $isActive: Boolean
  ) {
    updateAnnouncement(input: {
      pId: $id
      pTitle: $title
      pContent: $content
      pPriority: $priority
      pTargetAudience: $targetAudience
      pIsActive: $isActive
    }) {
      announcement {
        id
        title
        content
        priority
        targetAudience
        isActive
      }
    }
  }
`;

const DELETE_ANNOUNCEMENT = gql`
  mutation DeleteAnnouncement($id: UUID!) {
    deleteAnnouncement(input: { id: $id }) {
      uuid
    }
  }
`;

const TOGGLE_ANNOUNCEMENT = gql`
  mutation ToggleAnnouncement($id: UUID!) {
    toggleAnnouncement(input: { pId: $id }) {
      announcement {
        id
        isActive
      }
    }
  }
`;

const priorityColors = {
    urgent: 'bg-red-100 text-red-700 border border-red-200',
    high: 'bg-orange-100 text-orange-700 border border-orange-200',
    normal: 'bg-blue-100 text-blue-700 border border-blue-200',
    low: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

const audienceLabels = {
    all: 'Everyone',
    students: 'Students',
    teachers: 'Teachers',
};

export default function AnnouncementsPage() {
    const { loading, data, refetch } = useQuery(GET_ANNOUNCEMENTS);
    const [createAnnouncement] = useMutation(CREATE_ANNOUNCEMENT);
    const [updateAnnouncement] = useMutation(UPDATE_ANNOUNCEMENT);
    const [deleteAnnouncement] = useMutation(DELETE_ANNOUNCEMENT);
    const [toggleAnnouncement] = useMutation(TOGGLE_ANNOUNCEMENT);

    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState(null);

    const columns = [
        {
            header: 'Title',
            accessor: 'title',
            render: (row) => (
                <div className="max-w-[200px]">
                    <span className="font-semibold text-zinc-900 truncate block">{row.title}</span>
                </div>
            )
        },
        {
            header: 'Content',
            accessor: 'content',
            render: (row) => (
                <p className="text-sm text-zinc-500 line-clamp-2 max-w-[280px]">{row.content}</p>
            )
        },
        {
            header: 'Priority',
            accessor: 'priority',
            render: (row) => (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${priorityColors[row.priority] || priorityColors.normal}`}>
                    {row.priority}
                </span>
            )
        },
        {
            header: 'Audience',
            accessor: 'targetAudience',
            render: (row) => (
                <span className="text-sm text-zinc-600 font-medium">
                    {audienceLabels[row.targetAudience] || row.targetAudience}
                </span>
            )
        },
        {
            header: 'Status',
            accessor: 'isActive',
            render: (row) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(row); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${row.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                    title={row.isActive ? 'Click to deactivate' : 'Click to activate'}
                >
                    {row.isActive ? (
                        <><Eye className="w-3.5 h-3.5" /> Active</>
                    ) : (
                        <><EyeOff className="w-3.5 h-3.5" /> Inactive</>
                    )}
                </button>
            )
        },
        {
            header: 'Created By',
            accessor: 'userByCreatedBy.fullName',
            render: (row) => (
                <span className="text-sm text-zinc-600">
                    {row.userByCreatedBy?.fullName || '—'}
                </span>
            )
        },
        {
            header: 'Date',
            accessor: 'createdAt',
            render: (row) => (
                <span className="text-sm text-zinc-500">
                    {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            )
        },
    ];

    const handleAdd = () => {
        setEditData(null);
        setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditData(row);
        setModalOpen(true);
    };

    const handleDelete = async (row) => {
        if (!confirm('Delete this announcement? This cannot be undone.')) return;
        try {
            await deleteAnnouncement({ variables: { id: row.id } });
            toast.success('Announcement deleted');
            refetch();
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete: ' + err.message);
        }
    };

    const handleToggle = async (row) => {
        try {
            await toggleAnnouncement({ variables: { id: row.id } });
            toast.success(row.isActive ? 'Announcement deactivated' : 'Announcement activated');
            refetch();
        } catch (err) {
            console.error(err);
            toast.error('Failed to toggle: ' + err.message);
        }
    };

    const handleModalSubmit = async (formData) => {
        try {
            const userId = JSON.parse(localStorage.getItem('user') || '{}').id;

            if (editData) {
                await updateAnnouncement({
                    variables: {
                        id: editData.id,
                        title: formData.title,
                        content: formData.content,
                        priority: formData.priority,
                        targetAudience: formData.targetAudience,
                        isActive: editData.isActive,
                    }
                });
                toast.success('Announcement updated!');
            } else {
                const institutionId = getInstitutionIdFromStorage();
                if (!institutionId) {
                    toast.error('Missing institute context. Sign in again from your institute subdomain.');
                    return;
                }
                await createAnnouncement({
                    variables: {
                        title: formData.title,
                        content: formData.content,
                        institutionId,
                        priority: formData.priority,
                        targetAudience: formData.targetAudience,
                        createdBy: userId,
                    }
                });
                toast.success('Announcement published!');
            }
            setModalOpen(false);
            setEditData(null);
            refetch();
        } catch (err) {
            console.error(err);
            toast.error('Failed: ' + err.message);
        }
    };

    // Stats summary
    const announcements = data?.allAnnouncements?.nodes || [];
    const activeCount = announcements.filter(a => a.isActive).length;
    const urgentCount = announcements.filter(a => a.priority === 'urgent' || a.priority === 'high').length;

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 mb-2">Announcements</h1>
                <p className="text-zinc-500">Create and manage school-wide announcements.</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</p>
                            <p className="text-2xl font-bold text-zinc-900 mt-1">{announcements.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-primary-600" />
                        </div>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Eye className="w-5 h-5 text-emerald-600" />
                        </div>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl p-4 border border-zinc-100 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">High Priority</p>
                            <p className="text-2xl font-bold text-orange-600 mt-1">{urgentCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Data Table */}
            <DataTable
                title="All Announcements"
                columns={columns}
                data={announcements}
                isLoading={loading}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            {/* Modal */}
            <AnnouncementModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditData(null); }}
                onSubmit={handleModalSubmit}
                editData={editData}
            />
        </div>
    );
}

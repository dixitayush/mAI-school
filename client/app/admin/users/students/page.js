"use client";

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DataTable from '@/components/DataTable';
import StudentModal from '@/components/StudentModal';
import StudentFilterBar from '@/components/StudentFilterBar';
import Pagination from '@/components/Pagination';
import StudentId from '@/components/StudentId';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiBase, authHeaders, apiFetch } from '@/lib/api';
import { useFilterOptions, toQuery } from '@/lib/useFilterOptions';

const CREATE_STUDENT = gql`
  mutation CreateStudent(
    $fullName: String!, 
    $username: String!, 
    $email: String!, 
    $password: String!, 
    $classId: UUID,
    $parentName: String,
    $parentEmail: String,
    $parentPhone: String,
    $parentAddress: String
  ) {
    registerStudent(input: {
      fullName: $fullName
      username: $username
      email: $email
      password: $password
      classId: $classId
      parentName: $parentName
      parentEmail: $parentEmail
      parentPhone: $parentPhone
      parentAddress: $parentAddress
    }) {
      student {
        id
        registrationId
        enrollmentDate
        userByUserId {
          id
          fullName
          username
          profileByUserId {
            email
          }
        }
      }
    }
  }
`;

const UPDATE_STUDENT = gql`
  mutation UpdateStudent($studentId: UUID!, $userId: UUID!, $classId: UUID, $fullName: String!, $email: String!) {
    updateStudentById(input: { id: $studentId, studentPatch: { classId: $classId } }) {
      student {
        id
        classId
      }
    }
    updateUserById(input: { id: $userId, userPatch: { fullName: $fullName } }) {
      user {
        id
        fullName
      }
    }
    updateProfileByUserId(input: { userId: $userId, profilePatch: { email: $email } }) {
      profile {
        userId
        email
      }
    }
  }
`;

const DELETE_STUDENT = gql`
  mutation DeleteStudent($studentId: UUID!) {
    deleteStudentById(input: { id: $studentId }) {
      deletedStudentId
    }
  }
`;

const PAGE_SIZE = 50;

function StudentsContent() {
  // Global search links here with ?search=<registration id>.
  const searchParam = useSearchParams().get('search') || '';
  const [createStudent] = useMutation(CREATE_STUDENT);
  const [updateStudent] = useMutation(UPDATE_STUDENT);
  const [deleteStudent] = useMutation(DELETE_STUDENT);

  const [sendingEmail, setSendingEmail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // The roster is fetched a page at a time with the filters applied server
  // side: a 500–1000 student school cannot be loaded into the browser at once.
  const [filters, setFilters] = useState({
    session_id: '', class_id: '', section: '', grade_level: '', lifecycle_status: '', search: searchParam, page: 1,
  });

  useEffect(() => {
    if (searchParam) setFilters((f) => ({ ...f, search: searchParam, page: 1 }));
  }, [searchParam]);
  const [result, setResult] = useState({ students: [], total: 0, total_pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const { options } = useFilterOptions();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/students${toQuery({ ...filters, limit: PAGE_SIZE })}`);
      setResult({
        students: data.students || [],
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        page: data.page || 1,
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  const refetch = load;
  const rows = result.students;
  const getEmail = (row) => row.email;

  const columns = [
    {
      header: 'Reg. ID',
      accessor: 'registration_id',
      render: (row) => <StudentId value={row.registration_id} />,
    },
    { header: 'Name', accessor: 'full_name', render: (row) => row.full_name },
    { header: 'Username', accessor: 'username', render: (row) => row.username },
    { header: 'Roll No', accessor: 'roll_number', render: (row) => row.roll_number || '-' },
    {
      header: 'Class',
      accessor: 'class_name',
      render: (row) => (row.class_name ? `${row.class_name}${row.section ? ` · ${row.section}` : ''}` : 'Unassigned'),
    },
    { header: 'Email', accessor: 'email', render: (row) => row.email || '-' },
    { header: 'Parent', accessor: 'parent_name', render: (row) => row.parent_name || '-' },
    {
      header: 'Status',
      accessor: 'lifecycle_status',
      render: (row) => <span className="capitalize">{row.lifecycle_status || '-'}</span>,
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleSendEmail(row); }}
          disabled={sendingEmail === row.id}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
          title="Send Welcome Email"
        >
          {sendingEmail === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        </button>
      )
    }
  ];

  const handleAdd = () => {
    setSelectedStudent(null);
    setModalOpen(true);
  };

  const handleEdit = (row) => {
    // StudentModal still reads the GraphQL-shaped nesting.
    setSelectedStudent({
      ...row,
      classId: row.class_id,
      parentName: row.parent_name,
      parentEmail: row.parent_email,
      parentPhone: row.parent_phone,
      parentAddress: row.parent_address,
      userByUserId: {
        id: row.user_id,
        fullName: row.full_name,
        username: row.username,
        email: row.email,
      },
    });
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    if (confirm(`Are you sure you want to delete ${row.full_name}? This action cannot be undone.`)) {
      try {
        await deleteStudent({
          variables: { studentId: row.id }
        });
        toast.success('Student deleted successfully!');
        refetch();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete student: ' + err.message);
      }
    }
  };

  const handleModalSubmit = async (formData) => {
    try {
      if (selectedStudent) {
        await updateStudent({
          variables: {
            studentId: selectedStudent.id,
            userId: selectedStudent.userByUserId.id,
            classId: formData.classId || null,
            fullName: formData.fullName,
            email: formData.email
          }
        });
        toast.success('Student updated successfully!');
        setModalOpen(false);
        refetch();
      } else {
        const { data } = await createStudent({
          variables: {
            fullName: formData.fullName,
            username: formData.username,
            email: formData.email,
            password: formData.password,
            classId: formData.classId || null,
            parentName: formData.parentName || null,
            parentEmail: formData.parentEmail || null,
            parentPhone: formData.parentPhone || null,
            parentAddress: formData.parentAddress || null
          }
        });
        const regId = data?.registerStudent?.student?.registrationId;
        toast.success(regId ? `Student created — Registration ID ${regId}` : 'Student created successfully!');
        setModalOpen(false);
        refetch();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save student: ' + err.message);
    }
  };

  const handleSendEmail = async (row) => {
    const email = getEmail(row);
    if (!email) {
      toast.error(`${row.full_name} has no email on file`);
      return;
    }
    setSendingEmail(row.id);
    try {
      const res = await fetch(`${apiBase()}/api/email/send`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: email,
          subject: 'Welcome to mAI-school',
          text: `Hello ${row.full_name}, welcome to mAI-school!`
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Email sent!`, {
          duration: 5000,
          icon: '📧',
        });
      } else {
        toast.error(data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error sending email');
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Student Management</h1>
        <p className="text-zinc-500">Manage student records, enrollments, and classes.</p>
      </div>

      <StudentFilterBar
        value={filters}
        onChange={setFilters}
        show={['session', 'class', 'section', 'grade', 'status', 'search']}
        resultCount={result.total}
      />

      <DataTable
        title="All Students"
        columns={columns}
        data={rows}
        isLoading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchable={false}
        pageSize={PAGE_SIZE}
      />

      <Pagination
        page={result.page}
        totalPages={result.total_pages}
        total={result.total}
        limit={PAGE_SIZE}
        onPage={(p) => setFilters((f) => ({ ...f, page: p }))}
      />

      <StudentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        student={selectedStudent}
        classes={options.classes}
      />
    </div>
  );
}

export default function StudentsPage() {
  return (
    <ApolloWrapper>
      <Suspense fallback={null}>
        <StudentsContent />
      </Suspense>
    </ApolloWrapper>
  );
}

"use client";

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import DataTable from '@/components/DataTable';
import StudentModal from '@/components/StudentModal';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GET_STUDENTS = gql`
  query GetStudents {
    allStudents {
      nodes {
        id
        enrollmentDate
        classId
        parentByParentId {
          id
          fullName
          email
          phone
          address
        }
        userByUserId {
          id
          fullName
          username
          profileByUserId {
            email
          }
        }
        classByClassId {
          name
        }
      }
    }
    allClasses {
      nodes {
        id
        name
      }
    }
  }
`;

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

function StudentsContent() {
  const { loading, error, data, refetch } = useQuery(GET_STUDENTS);
  const [createStudent] = useMutation(CREATE_STUDENT);
  const [updateStudent] = useMutation(UPDATE_STUDENT);
  const [deleteStudent] = useMutation(DELETE_STUDENT);

  const [sendingEmail, setSendingEmail] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Helper to extract email safely
  const getEmail = (row) => row.userByUserId?.profileByUserId?.email;

  const columns = [
    { header: 'Name', accessor: 'userByUserId.fullName', render: (row) => row.userByUserId?.fullName },
    { header: 'Username', accessor: 'userByUserId.username', render: (row) => row.userByUserId?.username },
    { header: 'Email', accessor: 'email', render: (row) => getEmail(row) },
    { header: 'Parent', accessor: 'parentByParentId.fullName', render: (row) => row.parentByParentId?.fullName || '-' },
    { header: 'Class', accessor: 'classByClassId.name', render: (row) => row.classByClassId?.name || 'Unassigned' },
    { header: 'Enrollment Date', accessor: 'enrollmentDate' },
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
    // Transform data for the modal
    const studentForModal = {
      ...row,
      userByUserId: {
        ...row.userByUserId,
        email: getEmail(row) // Flatten email for the modal
      }
    };
    setSelectedStudent(studentForModal);
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    if (confirm(`Are you sure you want to delete ${row.userByUserId?.fullName}? This action cannot be undone.`)) {
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
        await createStudent({
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
        toast.success('Student created successfully!');
        setModalOpen(false);
        refetch();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save student: ' + err.message);
    }
  };

  const handleSendEmail = async (row) => {
    setSendingEmail(row.id);
    const email = getEmail(row);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email || 'student@example.com',
          subject: 'Welcome to mAI-school',
          text: `Hello ${row.userByUserId?.fullName}, welcome to mAI-school!`
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Email sent!`, {
          duration: 5000,
          icon: '📧',
        });
        console.log('Preview URL:', data.previewUrl);
      } else {
        toast.error('Failed to send email');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error sending email');
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Management</h1>
          <p className="text-gray-500">Manage student records, enrollments, and classes.</p>
        </div>

        <DataTable
          title="All Students"
          columns={columns}
          data={data?.allStudents?.nodes || []}
          isLoading={loading}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        <StudentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
          student={selectedStudent}
          classes={data?.allClasses?.nodes || []}
        />
      </main>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <ApolloWrapper>
      <StudentsContent />
    </ApolloWrapper>
  );
}

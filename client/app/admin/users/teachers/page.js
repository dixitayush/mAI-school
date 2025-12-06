"use client";

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import DataTable from '@/components/DataTable';
import TeacherModal from '@/components/TeacherModal';
import { toast } from 'react-hot-toast';

const GET_TEACHERS = gql`
  query GetTeachers {
    allTeachers {
      nodes {
        id
        subjectSpecialization
        qualification
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

const CREATE_TEACHER = gql`
  mutation CreateTeacher($fullName: String!, $username: String!, $email: String!, $password: String!, $subjectSpecialization: String!, $qualification: String!) {
    registerTeacher(input: {
      fullName: $fullName
      username: $username
      email: $email
      password: $password
      subjectSpecialization: $subjectSpecialization
      qualification: $qualification
    }) {
      teacher {
        id
        subjectSpecialization
        qualification
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

const UPDATE_TEACHER = gql`
  mutation UpdateTeacher($teacherId: UUID!, $userId: UUID!, $fullName: String!, $email: String!, $subjectSpecialization: String!, $qualification: String!) {
    updateTeacherById(input: { id: $teacherId, teacherPatch: { subjectSpecialization: $subjectSpecialization, qualification: $qualification } }) {
      teacher {
        id
        subjectSpecialization
        qualification
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

const DELETE_TEACHER = gql`
  mutation DeleteTeacher($teacherId: UUID!) {
    deleteTeacherById(input: { id: $teacherId }) {
      deletedTeacherId
    }
  }
`;

function TeachersContent() {
  const { loading, error, data, refetch } = useQuery(GET_TEACHERS);
  const [createTeacher] = useMutation(CREATE_TEACHER);
  const [updateTeacher] = useMutation(UPDATE_TEACHER);
  const [deleteTeacher] = useMutation(DELETE_TEACHER);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Helper to extract email safely
  const getEmail = (row) => row.userByUserId?.profileByUserId?.email;

  const columns = [
    { header: 'Name', accessor: 'userByUserId.fullName', render: (row) => row.userByUserId?.fullName },
    { header: 'Subject', accessor: 'subjectSpecialization' },
    { header: 'Qualification', accessor: 'qualification' },
    { header: 'Username', accessor: 'userByUserId.username', render: (row) => row.userByUserId?.username },
    { header: 'Email', accessor: 'email', render: (row) => getEmail(row) },
  ];

  const handleAdd = () => {
    setSelectedTeacher(null);
    setModalOpen(true);
  };

  const handleEdit = (row) => {
    // Transform data for the modal
    const teacherForModal = {
      ...row,
      userByUserId: {
        ...row.userByUserId,
        email: getEmail(row) // Flatten email for the modal
      }
    };
    setSelectedTeacher(teacherForModal);
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    if (confirm(`Are you sure you want to delete ${row.userByUserId?.fullName}? This action cannot be undone.`)) {
      try {
        await deleteTeacher({
          variables: { teacherId: row.id }
        });
        toast.success('Teacher deleted successfully!');
        refetch();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete teacher: ' + err.message);
      }
    }
  };

  const handleModalSubmit = async (formData) => {
    try {
      if (selectedTeacher) {
        await updateTeacher({
          variables: {
            teacherId: selectedTeacher.id,
            userId: selectedTeacher.userByUserId.id,
            fullName: formData.fullName,
            email: formData.email,
            subjectSpecialization: formData.subjectSpecialization,
            qualification: formData.qualification
          }
        });
        toast.success('Teacher updated successfully!');
        setModalOpen(false);
        refetch();
      } else {
        await createTeacher({
          variables: {
            fullName: formData.fullName,
            username: formData.username,
            email: formData.email,
            password: formData.password,
            subjectSpecialization: formData.subjectSpecialization,
            qualification: formData.qualification
          }
        });
        toast.success('Teacher created successfully!');
        setModalOpen(false);
        refetch();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save teacher: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Management</h1>
          <p className="text-gray-500">Manage teaching staff and specializations.</p>
        </div>

        <DataTable
          title="All Teachers"
          columns={columns}
          data={data?.allTeachers?.nodes || []}
          isLoading={loading}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        <TeacherModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
          teacher={selectedTeacher}
        />
      </main>
    </div>
  );
}

export default function TeachersPage() {
  return (
    <ApolloWrapper>
      <TeachersContent />
    </ApolloWrapper>
  );
}

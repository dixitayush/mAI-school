"use client";

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DataTable from '@/components/DataTable';
import ClassModal from '@/components/ClassModal'; // We need to create this
import { toast } from 'react-hot-toast';

// 1. GraphQL Queries & Mutations
const GET_CLASSES_AND_TEACHERS = gql`
  query GetClassesAndTeachers {
    allClasses {
      nodes {
        id
        name
        gradeLevel
        teacherId
        userByTeacherId {
          id
          fullName
        }
      }
    }
    allTeachers {
      nodes {
        id
        userByUserId {
          id
          fullName
          username
        }
      }
    }
  }
`;

const CREATE_CLASS = gql`
  mutation CreateClass($name: String!, $gradeLevel: Int!, $teacherId: UUID) {
    createClass(input: { name: $name, gradeLevel: $gradeLevel, teacherId: $teacherId }) {
      class {
        id
        name
        gradeLevel
        teacherId
      }
    }
  }
`;

const UPDATE_CLASS = gql`
  mutation UpdateClass($id: UUID!, $name: String!, $gradeLevel: Int!, $teacherId: UUID) {
    updateClass(input: { id: $id, name: $name, gradeLevel: $gradeLevel, teacherId: $teacherId }) {
      class {
        id
        name
        gradeLevel
        teacherId
      }
    }
  }
`;

const DELETE_CLASS = gql`
  mutation DeleteClass($id: UUID!) {
    deleteClass(input: { id: $id }) {
      clientMutationId
    }
  }
`;

function ClassesContent() {
  const { loading, error, data, refetch } = useQuery(GET_CLASSES_AND_TEACHERS);
  const [createClass] = useMutation(CREATE_CLASS);
  const [updateClass] = useMutation(UPDATE_CLASS);
  const [deleteClass] = useMutation(DELETE_CLASS);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  const columns = [
    { header: 'Class Name', accessor: 'name' },
    { header: 'Grade Level', accessor: 'gradeLevel' },
    { header: 'Class Teacher', accessor: 'userByTeacherId.fullName', render: (row) => row.userByTeacherId?.fullName || '-' },
  ];

  const handleAdd = () => {
    setSelectedClass(null);
    setModalOpen(true);
  };

  const handleEdit = (row) => {
    setSelectedClass(row);
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    if (confirm(`Are you sure you want to delete ${row.name}?`)) {
      try {
        await deleteClass({ variables: { id: row.id } });
        toast.success('Class deleted successfully!');
        refetch();
      } catch (err) {
        toast.error('Failed to delete class: ' + err.message);
      }
    }
  };

  const handleModalSubmit = async (formData) => {
    try {
      // Combine Class Label and Section to form Name
      // Logic: if Editing, we might need to parse existing Name, or just overwrite.
      // For Create: combine.
      // For Edit: we need to handle parsing if we want to pre-fill correctly.
      // But simplifying: just save 'name' as formData.classLabel + '-' + formData.section

      const combinedName = `${formData.classLabel}-${formData.section}`;

      if (selectedClass) {
        // Update
        // Note: For edit, the modal needs to be smart enough to split the name back or we just use a single name field.
        // For now, let's treat name as single field in Edit if we didn't implement split parsing in Modal.
        // Actually, looking at ClassModal implementation (next step), I'll ensure it handles logic.
        // But here we construct the payload.

        await updateClass({
          variables: {
            id: selectedClass.id,
            name: combinedName,
            gradeLevel: parseInt(formData.gradeLevel),
            teacherId: formData.teacherId || null
          }
        });
        toast.success('Class updated!');
      } else {
        // Create
        await createClass({
          variables: {
            name: combinedName,
            gradeLevel: parseInt(formData.gradeLevel),
            teacherId: formData.teacherId || null
          }
        });
        toast.success('Class created!');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Class Management</h1>
        <p className="text-gray-500">Manage classes, sections, and class teachers.</p>
      </div>

      <DataTable
        title="All Classes"
        columns={columns}
        data={data?.allClasses?.nodes || []}
        isLoading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ClassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        classData={selectedClass ? {
          ...selectedClass,
          // Simple hack to split name for pre-filling, assuming Format "Class-Section"
          // If not matching, just put full name in classLabel
          name: selectedClass.name, // Modal will handle parsing or we do it here.
          // Let's passed parsed props if possible, or let Modal handle it.
          // I'll update Modal to likely not need pre-parsing if I pass "name" and it has logic.
        } : null}
        teachers={data?.allTeachers?.nodes || []}
      />
    </div>
  );
}

export default function ClassesPage() {
  return (
    <ApolloWrapper>
      <ClassesContent />
    </ApolloWrapper>
  );
}

"use client";

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import DataTable from '@/components/DataTable';
import ExamModal from '@/components/ExamModal';
import { FileText, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GET_EXAMS_AND_CLASSES = gql`
  query GetExamsAndClasses {
    allExams {
      nodes {
        id
        title
        subject
        examDate
        totalMarks
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

const CREATE_EXAM = gql`
  mutation CreateExam($classId: UUID!, $title: String!, $subject: String!, $examDate: Date!, $totalMarks: Int!, $description: String) {
    createExam(input: {
      exam: {
        classId: $classId
        title: $title
        subject: $subject
        examDate: $examDate
        totalMarks: $totalMarks
        description: $description
      }
    }) {
      exam {
        id
        title
        subject
        examDate
        totalMarks
        classByClassId {
          name
        }
      }
    }
  }
`;

function ExamsContent() {
  const { loading, error, data, refetch } = useQuery(GET_EXAMS_AND_CLASSES);
  const [createExam] = useMutation(CREATE_EXAM);
  const [modalOpen, setModalOpen] = useState(false);

  const columns = [
    { header: 'Title', accessor: 'title' },
    { header: 'Subject', accessor: 'subject' },
    { header: 'Class', accessor: 'classByClassId.name', render: (row) => row.classByClassId?.name },
    { header: 'Date', accessor: 'examDate' },
    { header: 'Total Marks', accessor: 'totalMarks' },
  ];

  const handleCreateExam = () => {
    setModalOpen(true);
  };

  const handleModalSubmit = async (formData) => {
    try {
      await createExam({
        variables: {
          classId: formData.classId,
          title: formData.title,
          subject: formData.subject,
          examDate: formData.examDate,
          totalMarks: parseInt(formData.totalMarks),
          description: formData.description
        }
      });
      toast.success('Exam scheduled successfully!');
      setModalOpen(false);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule exam: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exams & Results</h1>
          <p className="text-gray-500">Schedule exams and manage results.</p>
        </div>

        <DataTable
          title="Scheduled Exams"
          columns={columns}
          data={data?.allExams?.nodes || []}
          isLoading={loading}
          onAdd={handleCreateExam}
        />

        <ExamModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
          classes={data?.allClasses?.nodes || []}
        />
      </main>
    </div>
  );
}

export default function ExamsPage() {
  return (
    <ApolloWrapper>
      <ExamsContent />
    </ApolloWrapper>
  );
}

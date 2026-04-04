"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable from '@/components/DataTable';
import ExamModal from '@/components/ExamModal';
import { FileText, Award, Loader2 } from 'lucide-react';
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
      classId: $classId
      title: $title
      subject: $subject
      examDate: $examDate
      totalMarks: $totalMarks
      description: $description
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
  const router = useRouter();
  const { loading, error, data, refetch } = useQuery(GET_EXAMS_AND_CLASSES);
  const [createExam] = useMutation(CREATE_EXAM);
  const [modalOpen, setModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
      setMounted(true);
      const storedUser = localStorage.getItem('user');
      const role = localStorage.getItem('role');

      if (!storedUser || !role) {
          router.push('/login');
      } else {
          setUserRole(role);
      }
  }, [router]);

  if (!mounted || !userRole) {
      return (
          <div className="flex min-h-[50vh] items-center justify-center bg-zinc-50">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
      );
  }

  const dashboardRole = ['admin', 'teacher', 'principal', 'student'].includes(userRole)
      ? userRole
      : 'admin';

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
    <DashboardLayout userRole={dashboardRole}>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900">Exams &amp; results</h1>
        <p className="text-zinc-600">Schedule exams and manage results.</p>
      </div>

      <DataTable
        title="Scheduled Exams"
        columns={columns}
        data={data?.allExams?.nodes || []}
        isLoading={loading}
        onAdd={userRole === 'admin' || userRole === 'principal' || userRole === 'teacher' ? handleCreateExam : undefined}
      />

      <ExamModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        classes={data?.allClasses?.nodes || []}
      />
    </DashboardLayout>
  );
}

export default function ExamsPage() {
  return (
    <ApolloWrapper>
      <ExamsContent />
    </ApolloWrapper>
  );
}

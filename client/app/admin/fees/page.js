"use client";

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Sidebar from '@/components/Sidebar';
import DataTable from '@/components/DataTable';
import InvoiceModal from '@/components/InvoiceModal';
import { CheckCircle, AlertCircle } from 'lucide-react';

const GET_FEES_AND_STUDENTS = gql`
  query GetFeesAndStudents {
    allFees {
      nodes {
        id
        amount
        description
        dueDate
        status
        invoiceNumber
        studentByStudentId {
          userByUserId {
            fullName
          }
        }
      }
    }
    allStudents {
      nodes {
        id
        classByClassId {
          name
        }
        userByUserId {
          fullName
        }
      }
    }
  }
`;

const CREATE_FEE = gql`
  mutation CreateFee($studentId: UUID!, $amount: BigFloat!, $description: String!, $dueDate: Date!, $invoiceNumber: String!) {
    createFee(input: {
      fee: {
        studentId: $studentId
        amount: $amount
        description: $description
        dueDate: $dueDate
        invoiceNumber: $invoiceNumber
      }
    }) {
      fee {
        id
        amount
        description
        dueDate
        status
        invoiceNumber
        studentByStudentId {
          userByUserId {
            fullName
          }
        }
      }
    }
  }
`;

function FeesContent() {
  const { loading, error, data, refetch } = useQuery(GET_FEES_AND_STUDENTS);
  const [createFee] = useMutation(CREATE_FEE);
  const [modalOpen, setModalOpen] = useState(false);

  const columns = [
    { header: 'Invoice #', accessor: 'invoiceNumber' },
    { header: 'Student', accessor: 'studentByStudentId.userByUserId.fullName', render: (row) => row.studentByStudentId?.userByUserId?.fullName },
    { header: 'Description', accessor: 'description' },
    { header: 'Amount', accessor: 'amount', render: (row) => `$${row.amount}` },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'paid' ? 'bg-green-100 text-green-700' :
          row.status === 'overdue' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
          {row.status.toUpperCase()}
        </span>
      )
    },
  ];

  const handleCreateInvoice = () => {
    setModalOpen(true);
  };

  const handleModalSubmit = async (formData) => {
    try {
      await createFee({
        variables: {
          studentId: formData.studentId,
          amount: formData.amount,
          description: formData.description,
          dueDate: formData.dueDate,
          invoiceNumber: formData.invoiceNumber
        }
      });
      alert('Invoice created successfully!');
      setModalOpen(false);
      refetch();
    } catch (err) {
      console.error(err);
      alert('Failed to create invoice: ' + err.message);
    }
  };

  // Calculate totals
  const totalCollected = data?.allFees?.nodes
    .filter(f => f.status === 'paid')
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0) || 0;

  const totalPending = data?.allFees?.nodes
    .filter(f => f.status === 'pending' || f.status === 'overdue')
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Fee Management</h1>
            <p className="text-gray-500">Track invoices, payments, and outstanding dues.</p>
          </div>
          <div className="flex space-x-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
              <div className="p-2 bg-green-50 rounded-full text-green-600"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Collected</p>
                <p className="font-bold text-gray-800 text-lg">${totalCollected.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
              <div className="p-2 bg-red-50 rounded-full text-red-600"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Pending</p>
                <p className="font-bold text-gray-800 text-lg">${totalPending.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        <DataTable
          title="Invoices"
          columns={columns}
          data={data?.allFees?.nodes || []}
          isLoading={loading}
          onAdd={handleCreateInvoice}
        />

        <InvoiceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
          students={data?.allStudents?.nodes || []}
        />
      </main>
    </div>
  );
}

export default function FeesPage() {
  return (
    <ApolloWrapper>
      <FeesContent />
    </ApolloWrapper>
  );
}

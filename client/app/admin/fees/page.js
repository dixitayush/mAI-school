"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DataTable from '@/components/DataTable';
import InvoiceModal from '@/components/InvoiceModal';
import StatCard from '@/components/StatCard';
import { toast } from 'react-hot-toast';
import { IndianRupee, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { formatInr, formatInrPrecise } from '@/lib/currency';

const GET_FEES = gql`
  query GetFees {
    allFees {
      nodes {
        id
        studentId
        amount
        description
        dueDate
        status
        paymentDate
        invoiceNumber
        studentByStudentId {
          id
          userByUserId {
            fullName
          }
          classByClassId {
            name
          }
        }
      }
    }
    allStudents {
      nodes {
        id
        userByUserId {
          fullName
        }
        classByClassId {
          name
        }
      }
    }
  }
`;

const CREATE_FEE = gql`
  mutation CreateFee(
    $studentId: UUID!
    $amount: BigFloat!
    $description: String
    $dueDate: Date!
    $status: String
    $invoiceNumber: String
  ) {
    createFee(
      input: {
        fee: {
          studentId: $studentId
          amount: $amount
          description: $description
          dueDate: $dueDate
          status: $status
          invoiceNumber: $invoiceNumber
        }
      }
    ) {
      fee {
        id
      }
    }
  }
`;

const UPDATE_FEE = gql`
  mutation UpdateFee(
    $id: UUID!
    $amount: BigFloat
    $description: String
    $dueDate: Date
    $status: String
    $paymentDate: Date
  ) {
    updateFeeById(
      input: {
        id: $id
        feePatch: {
          amount: $amount
          description: $description
          dueDate: $dueDate
          status: $status
          paymentDate: $paymentDate
        }
      }
    ) {
      fee {
        id
        status
        paymentDate
      }
    }
  }
`;

const DELETE_FEE = gql`
  mutation DeleteFee($id: UUID!) {
    deleteFeeById(input: { id: $id }) {
      deletedFeeId
    }
  }
`;

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
};

function FeesContent() {
  const { loading, data, refetch } = useQuery(GET_FEES);
  const [createFee] = useMutation(CREATE_FEE);
  const [updateFee] = useMutation(UPDATE_FEE);
  const [deleteFee] = useMutation(DELETE_FEE);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);

  const fees = useMemo(() => data?.allFees?.nodes || [], [data]);
  const students = data?.allStudents?.nodes || [];

  const totals = useMemo(() => {
    const sum = (rows) => rows.reduce((acc, f) => acc + parseFloat(f.amount || 0), 0);
    const paid = fees.filter((f) => f.status === 'paid');
    const overdue = fees.filter((f) => f.status === 'overdue');
    const pending = fees.filter((f) => f.status === 'pending');
    return {
      billed: sum(fees),
      collected: sum(paid),
      outstanding: sum(pending) + sum(overdue),
      overdue: sum(overdue),
    };
  }, [fees]);

  const columns = [
    { header: 'Invoice', accessor: 'invoiceNumber', render: (row) => row.invoiceNumber || '-' },
    {
      header: 'Student',
      accessor: 'student',
      render: (row) => row.studentByStudentId?.userByUserId?.fullName || 'Unknown',
    },
    {
      header: 'Class',
      accessor: 'class',
      render: (row) => row.studentByStudentId?.classByClassId?.name || '-',
    },
    { header: 'Description', accessor: 'description', render: (row) => row.description || '-' },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => <span className="font-medium">{formatInrPrecise(row.amount)}</span>,
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-IN') : '-'),
    },
    {
      header: 'Paid On',
      accessor: 'paymentDate',
      render: (row) =>
        row.paymentDate ? new Date(row.paymentDate).toLocaleDateString('en-IN') : '-',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
            STATUS_STYLES[row.status] || 'bg-zinc-100 text-zinc-700'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: 'Payment',
      accessor: 'actions',
      render: (row) =>
        row.status === 'paid' ? (
          <span className="text-xs text-zinc-400">Settled</span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMarkPaid(row);
            }}
            className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            <IndianRupee className="h-3 w-3" /> Mark Paid
          </button>
        ),
    },
  ];

  const handleAdd = () => {
    setSelectedFee(null);
    setModalOpen(true);
  };

  const handleEdit = (row) => {
    setSelectedFee(row);
    setModalOpen(true);
  };

  const handleDelete = async (row) => {
    const label = row.invoiceNumber || row.description || 'this fee record';
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteFee({ variables: { id: row.id } });
      toast.success('Fee record deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleMarkPaid = async (row) => {
    try {
      await updateFee({
        variables: {
          id: row.id,
          status: 'paid',
          paymentDate: new Date().toISOString().split('T')[0],
        },
      });
      toast.success('Payment recorded');
      refetch();
    } catch (err) {
      toast.error('Failed to record payment: ' + err.message);
    }
  };

  const handleModalSubmit = async (form) => {
    try {
      if (selectedFee) {
        await updateFee({
          variables: {
            id: selectedFee.id,
            amount: form.amount,
            description: form.description,
            dueDate: form.dueDate,
            status: form.status,
            // Clearing "paid" should clear the settlement date too.
            paymentDate:
              form.status === 'paid'
                ? selectedFee.paymentDate || new Date().toISOString().split('T')[0]
                : null,
          },
        });
        toast.success('Invoice updated');
      } else {
        await createFee({
          variables: {
            studentId: form.studentId,
            amount: form.amount,
            description: form.description,
            dueDate: form.dueDate,
            status: form.status || 'pending',
            invoiceNumber: form.invoiceNumber,
          },
        });
        toast.success('Invoice created');
      }
      setModalOpen(false);
      setSelectedFee(null);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Fee Management</h1>
        <p className="text-zinc-500">Raise invoices, track dues and record payments.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Billed" value={formatInr(totals.billed)} icon={Wallet} color="primary" />
        <StatCard title="Collected" value={formatInr(totals.collected)} icon={CheckCircle2} color="green" />
        <StatCard title="Outstanding" value={formatInr(totals.outstanding)} icon={IndianRupee} color="yellow" />
        <StatCard title="Overdue" value={formatInr(totals.overdue)} icon={AlertTriangle} color="red" />
      </div>

      <DataTable
        title="Fee Records"
        columns={columns}
        data={fees}
        isLoading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <InvoiceModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedFee(null);
        }}
        onSubmit={handleModalSubmit}
        students={students}
        fee={selectedFee}
      />
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

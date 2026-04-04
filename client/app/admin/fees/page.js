'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DataTable from '@/components/DataTable';
import { toast } from 'react-hot-toast';
import { DollarSign, CheckCircle, Clock } from 'lucide-react';

const GET_FEES = gql`
  query GetFees {
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
          classByClassId {
            name
          }
        }
      }
    }
  }
`;

const UPDATE_FEE_STATUS = gql`
  mutation UpdateFeeStatus($id: UUID!, $status: String!) {
    updateFeeById(input: { id: $id, feePatch: { status: $status } }) {
      fee {
        id
        status
      }
    }
  }
`;

function FeesContent() {
  const { loading, error, data, refetch } = useQuery(GET_FEES);
  const [updateFee] = useMutation(UPDATE_FEE_STATUS);

  const columns = [
    { header: 'Invoice #', accessor: 'invoiceNumber' },
    {
      header: 'Student',
      accessor: 'studentByStudentId.userByUserId.fullName',
      render: (row) => row.studentByStudentId?.userByUserId?.fullName || 'Unknown'
    },
    {
      header: 'Class',
      accessor: 'studentByStudentId.classByClassId.name',
      render: (row) => row.studentByStudentId?.classByClassId?.name || '-'
    },
    { header: 'Description', accessor: 'description' },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => <span className="font-medium">${Number(row.amount).toFixed(2)}</span>
    },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const colors = {
          paid: 'bg-green-100 text-green-700',
          pending: 'bg-yellow-100 text-yellow-700',
          overdue: 'bg-red-100 text-red-700'
        };
        const icons = {
          paid: CheckCircle,
          pending: Clock,
          overdue: Clock
        };
        const Icon = icons[row.status] || Clock;
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center w-fit gap-1 ${colors[row.status] || 'bg-zinc-100'}`}>
            <Icon className="w-3 h-3" />
            {row.status.toUpperCase()}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => row.status !== 'paid' && (
        <button
          onClick={(e) => { e.stopPropagation(); handleMarkPaid(row); }}
          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
          title="Mark as Paid"
        >
          <DollarSign className="w-3 h-3" /> Pay
        </button>
      )
    }
  ];

  const handleMarkPaid = async (row) => {
    try {
      await updateFee({
        variables: { id: row.id, status: 'paid' }
      });
      toast.success('Fee marked as paid!');
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Actions failed');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Fees Management</h1>
        <p className="text-zinc-500">Track invoices, payments, and outstanding balances.</p>
      </div>

      <DataTable
        title="All Fees & Invoices"
        columns={columns}
        data={data?.allFees?.nodes || []}
        isLoading={loading}
      // No Add/Edit for now in simple version, but can be added
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

"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="admin">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function OpsAdminLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="opsadmin">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

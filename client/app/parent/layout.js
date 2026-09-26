"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function ParentLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="parent">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

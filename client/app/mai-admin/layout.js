"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function MaiAdminLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="mai_admin">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

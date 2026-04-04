"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function PrincipalLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="principal">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

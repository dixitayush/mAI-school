"use client";

import { ApolloWrapper } from "@/components/ApolloWrapper";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherLayout({ children }) {
  return (
    <ApolloWrapper>
      <DashboardLayout userRole="teacher">{children}</DashboardLayout>
    </ApolloWrapper>
  );
}

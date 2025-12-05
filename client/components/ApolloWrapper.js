"use client";

import { ApolloProvider } from "@apollo/client";
import client from "@/lib/apolloClient";

export const ApolloWrapper = ({ children }) => {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
};

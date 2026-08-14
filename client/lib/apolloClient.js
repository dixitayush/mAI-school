import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';

const httpLink = createHttpLink({
    uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/graphql`,
});

const authLink = setContext((_, { headers }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : '',
        },
    };
});

/** Retry transient network failures only — never retry GraphQL application errors. */
const retryLink = new RetryLink({
    delay: {
        initial: 300,
        max: 2000,
        jitter: true,
    },
    attempts: {
        max: 3,
        retryIf: (error, _operation) => !!error && !error.result,
    },
});

const client = new ApolloClient({
    link: from([retryLink, authLink, httpLink]),
    cache: new InMemoryCache({
        typePolicies: {
            Query: {
                fields: {
                    // Keep list pages snappy when revisiting within a session.
                    allStudents: { merge: false },
                    allTeachers: { merge: false },
                    allClasses: { merge: false },
                    allFees: { merge: false },
                    allAnnouncements: { merge: false },
                },
            },
        },
    }),
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
        },
        query: {
            fetchPolicy: 'cache-first',
        },
    },
});

export default client;

export const metadata = {
  // Object form keeps the "· mAI-school" suffix for the nested reset pages.
  title: { default: "Sign in", template: "%s · mAI-school" },
};

export default function Layout({ children }) {
  return children;
}

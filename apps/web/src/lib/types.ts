export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { sites: number };
}

export interface Site {
  id: string;
  projectId: string;
  displayName: string;
  rootUrl: string;
  createdAt: string;
  updatedAt: string;
}

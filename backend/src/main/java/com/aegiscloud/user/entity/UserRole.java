package com.aegiscloud.user.entity;

/**
 * User roles in AegisCloud.
 *
 * ADMIN     - Full platform access, user management, all projects
 * DEVELOPER - Create/manage own projects, applications, deployments
 * VIEWER    - Read-only access to assigned projects
 */
public enum UserRole {
    ADMIN,
    DEVELOPER,
    VIEWER
}

"use server"

import { cookies } from "next/headers"

export async function setContext(projectId: string, pageId: string) {
    cookies().set("adnext_project", projectId, { path: '/' })
    cookies().set("adnext_page", pageId, { path: '/' })
}

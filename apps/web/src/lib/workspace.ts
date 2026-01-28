import { prisma } from "@/lib/prisma";

export async function getPrimaryWorkspace(userId: string, email: string) {
    // Find first workspace user is a member of
    const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true }
    });

    if (membership) {
        return membership.workspace;
    }

    // Check if user exists, if not create
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        if (email) {
            user = await prisma.user.create({
                data: {
                    id: userId,
                    email: email
                }
            });
        } else {
            throw new Error("User not found and no email provided");
        }
    }

    // Create default workspace
    const workspace = await prisma.workspace.create({
        data: {
            name: "Meu Workspace",
            ownerId: userId,
            members: {
                create: {
                    userId,
                    role: 'OWNER'
                }
            },
            // Create default folder
            workflowFolders: {
                create: {
                    name: 'Geral'
                }
            }
        }
    });

    return workspace;
}

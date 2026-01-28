/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
        outputFileTracingIncludes: {
            '/api/**/*': [
                './node_modules/.prisma/client/**/*',
                '../../node_modules/.prisma/client/**/*',
                '../../packages/db/node_modules/.prisma/client/**/*'
            ],
            '/**/*': [
                './node_modules/.prisma/client/**/*',
                '../../node_modules/.prisma/client/**/*',
                '../../packages/db/node_modules/.prisma/client/**/*'
            ]
        },
    },
    transpilePackages: ["@repo/db"],
};

export default nextConfig;

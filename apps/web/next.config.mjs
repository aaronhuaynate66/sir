/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sir/ai', '@sir/db', '@sir/shared', 'reactflow', '@reactflow/core', '@reactflow/background', '@reactflow/controls', '@reactflow/minimap'],
};

export default nextConfig;

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkHighlight from '@/lib/remarkHighlight';
import { getPost } from '@/lib/posts';
import { resolvePostRedirect } from '@/lib/postRedirects';
import ScrollToTop from '@/components/ScrollToTop';
import BackLink from '@/components/BackLink';
import PostAudioPlayer from '@/components/PostAudioPlayer';

// Empty array = nothing pre-rendered at `docker build` time (content/posts/*.md
// is a runtime-mounted volume and would be stale git-committed seed content at
// build time), but still gets ISR treatment: the first real request to any
// slug renders from the live volume and caches the result. revalidate = false
// means that cache never expires on its own — the admin routes call
// revalidatePath()/purgeAndWarm() on every edit, which is the only way this
// page should ever change, since posts change rarely once published.
export async function generateStaticParams() {
  return [];
}
export const revalidate = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const title = `${post.title} | The Break Surf`;
  return {
    title,
    description: post.excerpt,
    openGraph: { title, description: post.excerpt, images: [{ url: post.image }], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: post.excerpt, images: [post.image] },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    const target = await resolvePostRedirect(slug);
    if (target) redirect(`/writing/${target}`);
    notFound();
  }

  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      <ScrollToTop />
      {/* Breadcrumb */}
      <BackLink />

      {/* Cover image — contained to text width */}
      <div className="relative mb-8 overflow-hidden rounded-sm bg-sage/15" style={{ aspectRatio: '16/9' }}>
        <Image
          src={post.image}
          alt={post.title}
          fill
          priority
          sizes="(min-width: 768px) 48rem, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-forest/60 to-moss/40" />
      </div>

      {/* Title, subheading, then date */}
      <h1 className="font-display text-4xl font-medium leading-tight text-charcoal">
        {post.title}
      </h1>
      {post.subheading && (
        <p className="mt-3 text-lg leading-relaxed text-charcoal/60">{post.subheading}</p>
      )}
      <time className="mt-3 block text-xs font-medium uppercase tracking-widest text-charcoal/40">
        {formatDate(post.date)}
        {post.author && <> &middot; {post.author}</>}
      </time>

      {post.audio && <PostAudioPlayer src={post.audio} />}

      <hr className="mt-8 border-charcoal/10" />

        {/* Markdown body */}
        <div className="mt-10">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkHighlight]}
            remarkRehypeOptions={{
              handlers: {
                highlightMark: (state: unknown, node: { children: unknown[] }) => ({
                  type: 'element',
                  tagName: 'mark',
                  properties: {},
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  children: (state as any).all(node),
                }),
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any}
            components={{
              mark: ({ children }) => (
                <mark className="rounded-sm bg-terra/25 px-0.5 text-charcoal">{children}</mark>
              ),
              img: ({ src, alt }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof src === 'string' ? src : undefined}
                  alt={alt ?? ''}
                  loading="lazy"
                  className="my-8 w-full rounded-sm"
                />
              ),
              h2: ({ children }) => (
                <h2 className="font-display mt-10 mb-4 text-2xl font-medium text-charcoal">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-display mt-8 mb-3 text-xl font-medium text-charcoal">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="mb-6 text-base leading-relaxed text-charcoal/80">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-charcoal">{children}</strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-terra underline underline-offset-2 hover:text-terra/70 transition-colors"
                  target={href?.startsWith('http') ? '_blank' : undefined}
                  rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul className="mb-6 list-disc space-y-2 pl-5 text-charcoal/80">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-6 list-decimal space-y-2 pl-5 text-charcoal/80">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-base leading-relaxed">{children}</li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-6 border-l-2 border-terra pl-5 italic text-charcoal/60">
                  {children}
                </blockquote>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

      {/* Footer */}
      <div className="mt-16 border-t border-charcoal/10 pt-8">
        <Link
          href="/writing"
          className="text-xs font-medium uppercase tracking-widest text-terra hover:text-terra/70 transition-colors"
        >
          ← Back to all posts
        </Link>
      </div>
    </article>
  );
}

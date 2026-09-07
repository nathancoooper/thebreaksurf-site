import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import BlogImage from '@/components/BlogImage';

export const metadata = {
  title: 'Writing | The Break Surf',
  description: 'Thoughts on making things, the outdoors, and why it all matters.',
};

// Safety net: no dynamic segment here, so this always gets pre-rendered at
// `docker build` time from whatever's committed to git, not the live
// volume — revalidatePath fixes it instantly on a real edit, but this
// bounds the staleness window even if that never happens.
export const revalidate = 300;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default async function WritingPage() {
  const posts = await getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Header */}
      <div className="mb-14">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-terra">Journal</p>
        <h1 className="font-display text-4xl font-medium text-charcoal">Writing</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal/60">
          Thoughts on making things, the outdoors, and why it all matters.
        </p>
      </div>

      {/* Featured post */}
      <Link href={`/writing/${featured.slug}`} className="group mb-14 block">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-sm bg-sage/15">
            <div className="relative aspect-[4/3] w-full">
              <BlogImage
                src={featured.image}
                alt={featured.title}
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-forest/60 to-moss/40" />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <time className="text-xs font-medium uppercase tracking-widest text-charcoal/40">
              {formatDate(featured.date)}
              {featured.author && <> &middot; {featured.author}</>}
            </time>
            <h2 className="font-display mt-2 text-3xl font-medium text-charcoal transition-colors group-hover:text-terra">
              {featured.title}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/60">{featured.excerpt}</p>
            <span className="mt-6 text-xs font-medium uppercase tracking-widest text-terra">Read →</span>
          </div>
        </div>
      </Link>

      <hr className="mb-14 border-charcoal/10" />

      {/* Remaining posts */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map(post => (
          <Link key={post.slug} href={`/writing/${post.slug}`} className="group block">
            <div className="overflow-hidden rounded-sm bg-sage/15">
              <div className="relative aspect-[3/2] w-full">
                <BlogImage
                  src={post.image}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-forest/60 to-moss/40" />
              </div>
            </div>
            <div className="mt-4">
              <time className="text-xs font-medium uppercase tracking-widest text-charcoal/40">
                {formatDate(post.date)}
                {post.author && <> &middot; {post.author}</>}
              </time>
              <h2 className="font-display mt-1.5 text-xl font-medium text-charcoal transition-colors group-hover:text-terra">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/60 line-clamp-3">{post.excerpt}</p>
              <span className="mt-3 inline-block text-xs font-medium uppercase tracking-widest text-terra">Read →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

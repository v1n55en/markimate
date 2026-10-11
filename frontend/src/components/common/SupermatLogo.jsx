import logoSrc from '../../assets/logo.png';

export default function SupermatLogo({ size = 28, style = {}, alt = 'Agentia Logo' }) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'block',
        filter: 'drop-shadow(0 2px 8px rgba(6, 182, 212, 0.25))',
        ...style,
      }}
    />
  );
}

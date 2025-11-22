// src/components/common/CreatePostForm.js
import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { createPublication } from '../../services/publications';
import { uploadPublicationImage } from '../../services/storage';
import { toast } from '../../utils/toast';

export default function CreatePostForm({ onPostCreated }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        return () => {
            if (filePreview) {
                URL.revokeObjectURL(filePreview);
            }
        };
    }, [filePreview]);

    const handleFileChange = (event) => {
        const selected = event.target.files && event.target.files[0] ? event.target.files[0] : null;
        setFile(selected);
        if (filePreview) {
            URL.revokeObjectURL(filePreview);
        }
        if (selected) {
            setFilePreview(URL.createObjectURL(selected));
        } else {
            setFilePreview(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('El título es obligatorio');
            return;
        }

        try {
            setLoading(true);
            console.log('[CREATE POST FORM] Submitting:', { title, content, imageUrl });

            let finalImageUrl = imageUrl.trim() || null;
            if (file) {
                const user = getAuth().currentUser;
                if (!user) {
                    throw new Error('Debes iniciar sesión para subir imágenes');
                }
                try {
                    finalImageUrl = await uploadPublicationImage(file, user.uid);
                } catch (uploadError) {
                    console.error('[CREATE POST FORM] Upload error:', uploadError);
                    toast.error(`No se pudo subir la imagen: ${uploadError.message}`);
                    return;
                }
            }

            const result = await createPublication({
                title: title.trim(),
                content: content.trim() || null,
                imageUrl: finalImageUrl
            });

            console.log('[CREATE POST FORM] Success:', result);
            toast.success(`Post "${result.title}" creado exitosamente`);

            // Reset form
            setTitle('');
            setContent('');
            setImageUrl('');
            setFile(null);
            if (filePreview) {
                URL.revokeObjectURL(filePreview);
                setFilePreview(null);
            }

            // Notify parent component
            onPostCreated?.(result);

        } catch (error) {
            console.error('[CREATE POST FORM] Error:', error);
            toast.error(`Error creando post: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            margin: '20px',
            backgroundColor: '#f9f9f9'
        }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Crear Nueva Publicación</h3>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        Título *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título de tu publicación"
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                        disabled={loading}
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        Contenido
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Describe tu publicación..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px',
                            resize: 'vertical'
                        }}
                        disabled={loading}
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        Imagen desde tu equipo
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={loading}
                    />
                    {filePreview && (
                        <div style={{ marginTop: '8px' }}>
                            <img
                                src={filePreview}
                                alt="Vista previa"
                                style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ccc' }}
                            />
                        </div>
                    )}
                    <small style={{ display: 'block', marginTop: '4px', color: '#555' }}>
                        Puedes subir un archivo o pegar un URL en el campo siguiente.
                    </small>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        URL de Imagen (opcional)
                    </label>
                    <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                        disabled={loading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !title.trim()}
                    style={{
                        backgroundColor: loading ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? 'Creando...' : 'Crear Publicación'}
                </button>
            </form>
        </div>
    );
}

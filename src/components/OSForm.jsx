import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Send, Loader2, ChevronLeft, ChevronRight, Save, Images, X } from 'lucide-react';
import { createOS } from '../services/osService';

const DRAFT_KEY = 'appcampo_os_draft_v1';

const INITIAL_FORM_STATE = {
    responsavelMotiva: '',
    responsavelContratada: '',
    obraEquipamento: '',
    horarioInicio: '08:00',
    horarioFim: '18:00',
    local: '',
    segurancaTrabalho: 'Equipe com treinamento em NR 10 e 35, utilizacao de EPIs por funcao e tarefa, utilizacao de EPCs e sinalizacao de seguranca.',
    descricao: '',
    ocorrencias: '',
    status: 'Em andamento',
};

function OSForm({ onSuccess, currentUser }) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [photos, setPhotos] = useState([]);
    const galleryInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const steps = useMemo(
        () => [
            { id: 'dados', title: 'Dados basicos' },
            { id: 'descricao', title: 'Descricao' },
            { id: 'envio', title: 'Revisao e envio' },
        ],
        []
    );

    useEffect(() => {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (!savedDraft) return;

        try {
            const parsed = JSON.parse(savedDraft);
            setFormData((prev) => ({ ...prev, ...parsed }));
        } catch (error) {
            console.warn('Nao foi possivel restaurar rascunho de OS', error);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }, [formData]);

    const processPhotoFiles = async (files) => {
        try {
            const newPhotos = await Promise.all(
                files.map(
                    (file) =>
                        new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () =>
                                    resolve({
                                        id: crypto.randomUUID(),
                                        preview: reader.result,
                                        file,
                                        note: '',
                                    });
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        })
                )
            );

            setPhotos((prev) => [...prev, ...newPhotos]);
        } catch (error) {
            console.error('Erro ao processar fotos:', error);
            alert('Erro ao carregar algumas imagens.');
        }
    };

    const handlePhotoUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        await processPhotoFiles(files);
        event.target.value = '';
    };

    const removePhoto = (photoId) => {
        setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    };

    const handlePhotoNoteChange = (photoId, note) => {
        setPhotos((prev) => prev.map((photo) => (photo.id === photoId ? { ...photo, note } : photo)));
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const validateStep = () => {
        if (step === 0) {
            if (!formData.responsavelMotiva || !formData.responsavelContratada || !formData.obraEquipamento) {
                alert('Preencha os campos obrigatorios para continuar.');
                return false;
            }
        }

        if (step === 1) {
            if (!formData.descricao) {
                alert('A descricao detalhada e obrigatoria.');
                return false;
            }
        }

        return true;
    };

    const handleNextStep = () => {
        if (!validateStep()) return;
        setStep((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handlePreviousStep = () => {
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const resetForm = () => {
        setFormData(INITIAL_FORM_STATE);
        setPhotos([]);
        setStep(0);
        localStorage.removeItem(DRAFT_KEY);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateStep()) {
            return;
        }

        setLoading(true);

        try {
            await createOS(formData, photos, currentUser);
            resetForm();
            onSuccess();
        } catch (error) {
            console.error('Erro ao salvar OS:', error);

            if (error.name === 'QuotaExceededError') {
                alert('Limite de armazenamento no navegador atingido. Tente excluir relatorios antigos.');
            } else {
                alert('Erro ao salvar relatorio. Verifique sua conexao ou tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card field-mode-card">
            <div className="wizard-header">
                <h2>Relatorio Diario de Obras</h2>
                <p className="text-muted">
                    Etapa {step + 1} de {steps.length}: {steps[step].title}
                </p>
                <div className="wizard-progress-track">
                    <div className="wizard-progress-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
                </div>
            </div>

            <div className="photo-quick-panel">
                <div className="photo-quick-actions">
                    <button type="button" className="btn" style={{ background: '#1e40af', color: '#fff' }} onClick={() => cameraInputRef.current?.click()}>
                        <Camera size={18} />
                        Tirar foto
                    </button>
                    <button type="button" className="btn" style={{ background: '#334155', color: '#fff' }} onClick={() => galleryInputRef.current?.click()}>
                        <Images size={18} />
                        Galeria
                    </button>
                    <span className="text-muted photo-counter">{photos.length} foto(s)</span>
                </div>

                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <input ref={galleryInputRef} type="file" multiple accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />

                {photos.length > 0 && (
                    <div className="photo-grid">
                        {photos.map((photo) => (
                            <div key={photo.id} className="photo-item">
                                <div className="photo-preview">
                                    <img src={photo.preview} alt="preview" />
                                    <button type="button" className="remove-photo-btn" onClick={() => removePhoto(photo.id)}>
                                        <X size={12} />
                                    </button>
                                </div>
                                <div className="photo-note-box">
                                    <textarea
                                        rows={2}
                                        value={photo.note || ''}
                                        onChange={(event) => handlePhotoNoteChange(photo.id, event.target.value)}
                                        placeholder="Observacao da foto (vai para PDF e Excel)"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                {step === 0 && (
                    <>
                        <div className="form-grid form-grid-2">
                            <div className="form-group">
                                <label>RESPONSAVEL MOTIVA</label>
                                <input
                                    name="responsavelMotiva"
                                    required
                                    value={formData.responsavelMotiva}
                                    onChange={handleChange}
                                    placeholder="Ex: Jonathan/Fabio"
                                />
                            </div>
                            <div className="form-group">
                                <label>RESPONSAVEL CONTRATADA</label>
                                <input
                                    name="responsavelContratada"
                                    required
                                    value={formData.responsavelContratada}
                                    onChange={handleChange}
                                    placeholder="Ex: Gustavo Penedo"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>OBRA/EQUIPAMENTO</label>
                            <input
                                name="obraEquipamento"
                                required
                                value={formData.obraEquipamento}
                                onChange={handleChange}
                                placeholder="Ex: SEGURANCA FREE FLOW SOROCABANA"
                            />
                        </div>

                        <div className="form-grid form-grid-3">
                            <div className="form-group">
                                <label>HORARIO INICIO</label>
                                <input type="time" name="horarioInicio" value={formData.horarioInicio} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>HORARIO FIM</label>
                                <input type="time" name="horarioFim" value={formData.horarioFim} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>LOCAL</label>
                                <input name="local" value={formData.local} onChange={handleChange} placeholder="Ex: P06/P07" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>STATUS</label>
                            <select name="status" value={formData.status} onChange={handleChange}>
                                <option value="Em andamento">Em andamento</option>
                                <option value="Aguardando">Aguardando</option>
                                <option value="Concluido">Concluido</option>
                            </select>
                        </div>
                    </>
                )}

                {step === 1 && (
                    <>
                        <div className="form-group">
                            <label>SEGURANCA DO TRABALHO</label>
                            <textarea name="segurancaTrabalho" rows={3} value={formData.segurancaTrabalho} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>DESCRICAO DETALHADA</label>
                            <textarea
                                name="descricao"
                                required
                                rows={8}
                                value={formData.descricao}
                                onChange={handleChange}
                                placeholder="Descreva o servico realizado..."
                            />
                        </div>

                        <div className="form-group">
                            <label>OCORRENCIAS</label>
                            <textarea
                                name="ocorrencias"
                                rows={4}
                                value={formData.ocorrencias}
                                onChange={handleChange}
                                placeholder="Relate problemas ou imprevistos..."
                            />
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="draft-hint">
                            <Save size={16} />
                            Rascunho salvo automaticamente no dispositivo.
                        </div>
                    </>
                )}

                <div className="wizard-footer">
                    <div className="wizard-footer-inner">
                        {step > 0 ? (
                            <button type="button" className="btn" onClick={handlePreviousStep} disabled={loading}>
                                <ChevronLeft size={16} />
                                Voltar
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < steps.length - 1 ? (
                            <button type="button" className="btn btn-primary" onClick={handleNextStep} disabled={loading}>
                                Proxima etapa
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                Finalizar e salvar
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}

export default OSForm;
